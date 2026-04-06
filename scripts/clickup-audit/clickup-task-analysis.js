/**
 * ClickUp Task Analysis
 * Deep dive into task structures and patterns
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data/clickup-audit');
const auditData = require(path.join(DATA_DIR, 'clickup-full-audit.json'));

// Export analysis as JSON for IRIS import planning
const analysisResults = {
  generatedAt: new Date().toISOString(),
  overview: {},
  projectStructure: {},
  taskPatterns: {},
  listTemplates: {},
  customFieldMapping: {},
  automationOpportunities: []
};

console.log('='.repeat(60));
console.log('CLICKUP TASK ANALYSIS - DETAILED REPORT');
console.log('='.repeat(60));

// 1. Project Structure Analysis
console.log('\n== PROJECT STRUCTURE ANALYSIS ==\n');

const projectFolders = auditData.folders.filter(f => f.spaceName === 'Land Development' && f.name !== 'BSE Improvements');

projectFolders.forEach(folder => {
  const listsInFolder = auditData.lists.filter(l => l.folderName === folder.name);
  const tasksInFolder = auditData.tasks.filter(t => t._folderName === folder.name);
  
  analysisResults.projectStructure[folder.name] = {
    folderId: folder.id,
    lists: listsInFolder.map(l => ({
      name: l.name,
      id: l.id,
      taskCount: auditData.tasks.filter(t => t._listName === l.name && t._folderName === folder.name).length
    })),
    totalTasks: tasksInFolder.length,
    tasksByStatus: {}
  };
  
  // Count by status
  tasksInFolder.forEach(t => {
    const status = t.status?.status || 'unknown';
    analysisResults.projectStructure[folder.name].tasksByStatus[status] = 
      (analysisResults.projectStructure[folder.name].tasksByStatus[status] || 0) + 1;
  });
});

console.log('Project structures analyzed:', Object.keys(analysisResults.projectStructure).length);

// 2. List Templates
console.log('\n== LIST TEMPLATES ==\n');

// Find common list patterns
const listTypeCount = {};
auditData.lists.filter(l => l.folderName).forEach(l => {
  listTypeCount[l.name] = (listTypeCount[l.name] || 0) + 1;
});

// Lists that appear in 3+ projects are candidates for templates
const templateCandidates = Object.entries(listTypeCount)
  .filter(([name, count]) => count >= 3)
  .sort((a, b) => b[1] - a[1]);

templateCandidates.forEach(([listName, count]) => {
  console.log(`${listName}: appears in ${count} projects`);
  
  // Get common tasks in this list type
  const tasksInListType = auditData.tasks.filter(t => t._listName === listName && !t.parent);
  const taskNameFreq = {};
  tasksInListType.forEach(t => {
    // Normalize task names (remove project numbers, dates)
    const normalized = t.name
      .replace(/\d{2}-\d{2}\s+/g, '')
      .replace(/\d{2}[/-]\d{2}[/-]\d{2,4}/g, 'DATE')
      .trim();
    taskNameFreq[normalized] = (taskNameFreq[normalized] || 0) + 1;
  });
  
  // Tasks appearing in 2+ projects are template candidates
  const commonTasks = Object.entries(taskNameFreq)
    .filter(([name, freq]) => freq >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  analysisResults.listTemplates[listName] = {
    frequency: count,
    templateTasks: commonTasks.map(([name, freq]) => ({ name, frequency: freq }))
  };
  
  if (commonTasks.length > 0) {
    console.log('  Common tasks:');
    commonTasks.forEach(([name, freq]) => console.log(`    - "${name}" (${freq}x)`));
  }
});

// 3. Custom Field Mapping
console.log('\n== CUSTOM FIELD MAPPING FOR IRIS ==\n');

const customFieldAnalysis = {};
auditData.tasks.forEach(t => {
  t.custom_fields?.forEach(cf => {
    if (!customFieldAnalysis[cf.name]) {
      customFieldAnalysis[cf.name] = {
        type: cf.type,
        usageCount: 0,
        options: cf.type_config?.options?.map(o => o.name) || [],
        usedInLists: new Set(),
        sampleValues: []
      };
    }
    customFieldAnalysis[cf.name].usageCount++;
    if (t._listName) customFieldAnalysis[cf.name].usedInLists.add(t._listName);
    
    // Capture sample values
    if (cf.value != null && customFieldAnalysis[cf.name].sampleValues.length < 5) {
      if (cf.type === 'drop_down' && cf.type_config?.options) {
        const opt = cf.type_config.options.find(o => o.orderindex === cf.value);
        if (opt) customFieldAnalysis[cf.name].sampleValues.push(opt.name);
      } else {
        customFieldAnalysis[cf.name].sampleValues.push(String(cf.value).substring(0, 50));
      }
    }
  });
});

Object.entries(customFieldAnalysis).forEach(([name, info]) => {
  console.log(`\n${name} (${info.type})`);
  console.log(`  Usage: ${info.usageCount} tasks`);
  console.log(`  Lists: ${Array.from(info.usedInLists).slice(0, 5).join(', ')}`);
  if (info.options.length > 0) {
    console.log(`  Options: ${info.options.join(', ')}`);
  }
  if (info.sampleValues.length > 0) {
    console.log(`  Sample values: ${info.sampleValues.join(', ')}`);
  }
  
  // Store for export
  analysisResults.customFieldMapping[name] = {
    type: info.type,
    usageCount: info.usageCount,
    options: info.options,
    usedInLists: Array.from(info.usedInLists),
    irisEquivalent: mapToIrisField(name, info)
  };
});

function mapToIrisField(fieldName, fieldInfo) {
  // Map ClickUp fields to IRIS schema
  const mapping = {
    'Agency': { table: 'agency_catalog', column: 'id', type: 'foreign_key' },
    'Permit Status': { table: 'project_permit_selections', column: 'status', type: 'enum' },
    'Duration': { computed: true, formula: 'date_diff(created_at, completed_at)' },
    'Comments Due': { table: 'tasks', column: 'due_date', type: 'timestamptz' },
    'Notes': { table: 'tasks', column: 'description', type: 'text' },
    'Signature': { table: 'tasks', column: 'custom_fields.signature', type: 'dropdown' },
    'Status': { table: 'tasks', column: 'custom_fields.doc_status', type: 'dropdown' },
    'From': { table: 'tasks', column: 'custom_fields.source', type: 'dropdown' },
    'Review Comments/Notes': { table: 'tasks', column: 'custom_fields.review_notes', type: 'text' }
  };
  return mapping[fieldName] || { table: 'tasks', column: 'custom_fields.' + fieldName.toLowerCase().replace(/\s+/g, '_'), type: 'jsonb' };
}

// 4. Automation Opportunities
console.log('\n== AUTOMATION OPPORTUNITIES ==\n');

const opportunities = [
  {
    name: 'Auto-create permit tasks',
    trigger: 'project_permit_selections.insert',
    action: 'Create task in Permits list',
    details: 'When a permit is selected for a project, auto-create the tracking task'
  },
  {
    name: 'Auto-create submittal tasks',
    trigger: 'project_required_items.insert',
    action: 'Create task in Submittals list',
    details: 'When required items are added, create corresponding submittal tracking tasks'
  },
  {
    name: 'Permit status → Task update',
    trigger: 'project_permit_selections.status.update',
    action: 'Update task status, create subtasks',
    details: 'When permit status changes to RAI, create comment response task with due date'
  },
  {
    name: 'Auto-assign by agency',
    trigger: 'tasks.insert WHERE agency_id IS NOT NULL',
    action: 'Assign based on agency-engineer mapping',
    details: 'E.g., SJRWMD tasks → Wesley, JEA tasks → Burke'
  },
  {
    name: 'Due date reminders',
    trigger: 'CRON: daily at 8am',
    action: 'Notify assignees of upcoming due dates',
    details: 'Tasks due within 3 days, tasks overdue'
  },
  {
    name: 'Closeout template',
    trigger: 'All permits approved for project',
    action: 'Create closeout task list from template',
    details: 'Auto-generate standard closeout tasks'
  },
  {
    name: 'Review cycle tracking',
    trigger: 'Task completed in Permits where name matches "Nth Review"',
    action: 'Create next cycle subtasks if not approved',
    details: 'Auto-create "Nth Revision" and "N+1 Submittal" subtasks'
  }
];

opportunities.forEach((opp, i) => {
  console.log(`${i + 1}. ${opp.name}`);
  console.log(`   Trigger: ${opp.trigger}`);
  console.log(`   Action: ${opp.action}`);
  console.log(`   ${opp.details}\n`);
});

analysisResults.automationOpportunities = opportunities;

// 5. Task Name Patterns for Parsing
console.log('\n== TASK NAME PATTERNS ==\n');

const namePatterns = {
  reviewCycle: /^(\d+)(st|nd|rd|th)\s+(review|submittal|revision)/i,
  approval: /^approval$/i,
  agency: /^(JEA|COJ|SJRWMD|FDEP|FDOT|SJC)/i,
  actionItem: /^(submit|prepare|receive|send|call|review)/i
};

let matchCounts = {};
auditData.tasks.forEach(t => {
  Object.entries(namePatterns).forEach(([patternName, regex]) => {
    if (regex.test(t.name)) {
      matchCounts[patternName] = (matchCounts[patternName] || 0) + 1;
    }
  });
});

console.log('Task Name Pattern Matches:');
Object.entries(matchCounts).forEach(([pattern, count]) => {
  console.log(`  ${pattern}: ${count} tasks`);
});

// 6. Summary Statistics
console.log('\n== SUMMARY STATISTICS ==\n');

analysisResults.overview = {
  totalTasks: auditData.summary.totalTasks,
  totalSubtasks: auditData.summary.totalSubtasks,
  totalLists: auditData.summary.totalLists,
  totalFolders: auditData.summary.totalFolders,
  tasksWithDueDate: auditData.summary.tasksWithDueDate,
  tasksOverdue: auditData.summary.tasksOverdue,
  assignmentRate: ((auditData.summary.totalTasks + auditData.summary.totalSubtasks - auditData.summary.tasksByAssignee['Unassigned']) / (auditData.summary.totalTasks + auditData.summary.totalSubtasks) * 100).toFixed(1) + '%',
  completionRate: (auditData.summary.tasksByStatus['complete'] / (auditData.summary.totalTasks + auditData.summary.totalSubtasks) * 100).toFixed(1) + '%'
};

console.log(`Total Tasks: ${analysisResults.overview.totalTasks}`);
console.log(`Total Subtasks: ${analysisResults.overview.totalSubtasks}`);
console.log(`Assignment Rate: ${analysisResults.overview.assignmentRate}`);
console.log(`Completion Rate: ${analysisResults.overview.completionRate}`);
console.log(`Tasks with Due Dates: ${analysisResults.overview.tasksWithDueDate}`);
console.log(`Currently Overdue: ${analysisResults.overview.tasksOverdue}`);

// Save analysis results
const outputPath = path.join(DATA_DIR, 'clickup-analysis-results.json');
fs.writeFileSync(outputPath, JSON.stringify(analysisResults, null, 2));
console.log(`\n✅ Analysis saved to: ${outputPath}`);

console.log('\n' + '='.repeat(60));
console.log('END OF ANALYSIS');
console.log('='.repeat(60));
