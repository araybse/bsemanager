#!/usr/bin/env npx tsx

/**
 * Backfill script for Knowledge Review Queue
 * 
 * Scans knowledge-v2 JSON files and identifies threads that may be misfiled:
 * - Threads with crossProjectReferences where isPrimary is true
 * - Threads where narrative mentions it's about a different project
 * 
 * Usage:
 *   cd bsemanager && npx tsx scripts/backfill-knowledge-review.ts
 *   
 * Requires:
 *   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

const KNOWLEDGE_DIR = path.join(process.env.HOME || '', '.openclaw/workspace/memory/knowledge-v2');

interface CrossProjectRef {
  projectName?: string;
  projectNumber?: string;
  context?: string;
  isPrimary?: boolean;
}

interface Thread {
  threadId: string;
  processedDate?: string;
  narrative?: {
    summary?: string;
    key_takeaways?: string[];
    future_relevance?: string;
  };
  metadata?: {
    crossProjectReferences?: CrossProjectRef[];
    people?: any[];
    dates?: any[];
    decisions?: any[];
  };
  sourceEmails?: Array<{
    subject?: string;
    from?: string;
    date?: string;
  }>;
  emailCount?: number;
}

interface KnowledgeFile {
  projectNumber: string;
  projectName: string;
  threads: Thread[];
}

interface ReviewItem {
  thread_id: string;
  file_project: string;
  suggested_project: string | null;
  subject: string | null;
  preview: string | null;
  processed_date: string | null;
  status: string;
  issue_type: string;
  metadata: Thread;
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    console.error('Set these environment variables and try again.');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Check if directory exists
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    console.error(`Knowledge directory not found: ${KNOWLEDGE_DIR}`);
    process.exit(1);
  }
  
  const files = fs.readdirSync(KNOWLEDGE_DIR).filter(f => f.endsWith('.json'));
  console.log(`Found ${files.length} knowledge files to scan`);
  
  const itemsToInsert: ReviewItem[] = [];
  let totalThreads = 0;
  let misfiledCount = 0;
  
  for (const file of files) {
    const filePath = path.join(KNOWLEDGE_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    let data: KnowledgeFile;
    try {
      data = JSON.parse(content);
    } catch (e) {
      console.warn(`Failed to parse ${file}, skipping`);
      continue;
    }
    
    const fileProject = data.projectNumber || file.replace('-v2-knowledge.json', '');
    console.log(`Scanning ${fileProject} (${data.threads?.length || 0} threads)...`);
    
    for (const thread of data.threads || []) {
      totalThreads++;
      
      // Check for misfiled threads (crossProjectReferences with isPrimary: true)
      const primaryRefs = (thread.metadata?.crossProjectReferences || [])
        .filter(ref => ref.isPrimary === true);
      
      if (primaryRefs.length > 0) {
        misfiledCount++;
        
        const primaryRef = primaryRefs[0];
        const subject = thread.sourceEmails?.[0]?.subject || 'No subject';
        const preview = thread.narrative?.summary?.substring(0, 200) || '';
        
        itemsToInsert.push({
          thread_id: thread.threadId,
          file_project: fileProject,
          suggested_project: primaryRef.projectNumber || primaryRef.projectName || null,
          subject,
          preview,
          processed_date: thread.processedDate || null,
          status: 'pending',
          issue_type: 'misfiled',
          metadata: thread
        });
      }
    }
  }
  
  console.log(`\nScan complete:`);
  console.log(`  Total threads: ${totalThreads}`);
  console.log(`  Misfiled threads: ${misfiledCount}`);
  console.log(`  Items to insert: ${itemsToInsert.length}`);
  
  if (itemsToInsert.length === 0) {
    console.log('\nNo items to insert. Exiting.');
    return;
  }
  
  // Batch insert (upsert to avoid duplicates)
  console.log('\nInserting items into knowledge_review_queue...');
  
  const batchSize = 50;
  let inserted = 0;
  let skipped = 0;
  
  for (let i = 0; i < itemsToInsert.length; i += batchSize) {
    const batch = itemsToInsert.slice(i, i + batchSize);
    
    const { data, error } = await supabase
      .from('knowledge_review_queue')
      .upsert(batch, { 
        onConflict: 'thread_id',
        ignoreDuplicates: true 
      })
      .select('id');
    
    if (error) {
      console.error(`Error inserting batch ${i}-${i + batch.length}:`, error.message);
    } else {
      inserted += data?.length || 0;
    }
  }
  
  console.log(`\nInserted ${inserted} new items`);
  console.log('Done!');
}

main().catch(console.error);
