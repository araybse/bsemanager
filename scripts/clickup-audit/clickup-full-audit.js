/**
 * ClickUp Full Audit - Comprehensive workspace analysis
 * Fetches complete hierarchy with all tasks, custom fields, and metadata
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
require('dotenv').config({ path: path.join(process.env.HOME, '/automation/.env') });

const CLICKUP_TOKEN = process.env.CLICKUP_API_KEY;
const TEAM_ID = '9011205377';
const OUTPUT_DIR = path.join(__dirname, '../../data/clickup-audit');

if (!CLICKUP_TOKEN) {
  console.error('❌ CLICKUP_API_KEY not found');
  process.exit(1);
}

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function fetchApi(urlPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.clickup.com',
      path: urlPath,
      method: 'GET',
      headers: {
        'Authorization': CLICKUP_TOKEN,
        'Content-Type': 'application/json'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 429) {
          reject(new Error('RATE_LIMITED'));
        } else if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        } else {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`JSON parse error: ${e.message}`));
          }
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function fetchWithRetry(urlPath, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetchApi(urlPath);
    } catch (e) {
      if (e.message === 'RATE_LIMITED') {
        console.log('  ⏳ Rate limited, waiting 30s...');
        await sleep(30000);
      } else if (i < retries - 1) {
        console.log(`  ⚠️ Retry ${i + 1}/${retries}: ${e.message}`);
        await sleep(1000);
      } else {
        throw e;
      }
    }
  }
}

const auditData = {
  meta: {
    teamId: TEAM_ID,
    auditDate: new Date().toISOString(),
    version: '1.0'
  },
  spaces: [],
  folders: [],
  lists: [],
  tasks: [],
  customFields: new Set(),
  statuses: new Set(),
  assignees: new Set(),
  tags: new Set(),
  summary: {
    totalSpaces: 0,
    totalFolders: 0,
    totalLists: 0,
    totalTasks: 0,
    totalSubtasks: 0,
    tasksByStatus: {},
    tasksByAssignee: {},
    tasksByList: {},
    tasksByFolder: {},
    tasksWithDueDate: 0,
    tasksOverdue: 0,
    tasksByPriority: {},
    customFieldsUsed: {}
  }
};

async function fetchAllTasks(listId, listName, folderName) {
  const tasks = [];
  let page = 0;
  let hasMore = true;
  
  while (hasMore) {
    const urlPath = `/api/v2/list/${listId}/task?page=${page}&include_closed=true&subtasks=true`;
    const data = await fetchWithRetry(urlPath);
    
    if (data.tasks && data.tasks.length > 0) {
      for (const task of data.tasks) {
        tasks.push({
          ...task,
          _listName: listName,
          _folderName: folderName
        });
      }
      page++;
      await sleep(300); // Be gentle with API
    } else {
      hasMore = false;
    }
  }
  
  return tasks;
}

(async () => {
  try {
    console.log('🔍 Starting ClickUp Full Audit...\n');
    const now = Date.now();
    
    // Get all spaces
    console.log('📁 Fetching spaces...');
    const spacesData = await fetchWithRetry(`/api/v2/team/${TEAM_ID}/space`);
    auditData.summary.totalSpaces = spacesData.spaces.length;
    
    for (const space of spacesData.spaces) {
      console.log(`\n📂 Space: ${space.name}`);
      auditData.spaces.push({
        id: space.id,
        name: space.name,
        statuses: space.statuses
      });
      
      // Record space statuses
      if (space.statuses) {
        space.statuses.forEach(s => auditData.statuses.add(JSON.stringify(s)));
      }
      
      // Get space-level lists
      await sleep(300);
      const spaceListsData = await fetchWithRetry(`/api/v2/space/${space.id}/list?archived=false`);
      
      for (const list of spaceListsData.lists || []) {
        console.log(`  📋 List (space-level): ${list.name}`);
        auditData.lists.push({
          id: list.id,
          name: list.name,
          spaceName: space.name,
          folderName: null,
          taskCount: list.task_count
        });
        auditData.summary.totalLists++;
        
        // Fetch tasks
        const tasks = await fetchAllTasks(list.id, list.name, null);
        console.log(`     → ${tasks.length} tasks`);
        auditData.tasks.push(...tasks);
      }
      
      // Get folders
      await sleep(300);
      const foldersData = await fetchWithRetry(`/api/v2/space/${space.id}/folder?archived=false`);
      
      for (const folder of foldersData.folders || []) {
        console.log(`  📂 Folder: ${folder.name}`);
        auditData.folders.push({
          id: folder.id,
          name: folder.name,
          spaceName: space.name
        });
        auditData.summary.totalFolders++;
        
        // Get lists in folder
        await sleep(300);
        const listsData = await fetchWithRetry(`/api/v2/folder/${folder.id}/list?archived=false`);
        
        for (const list of listsData.lists || []) {
          console.log(`    📋 List: ${list.name}`);
          auditData.lists.push({
            id: list.id,
            name: list.name,
            spaceName: space.name,
            folderName: folder.name,
            taskCount: list.task_count
          });
          auditData.summary.totalLists++;
          
          // Fetch tasks
          const tasks = await fetchAllTasks(list.id, list.name, folder.name);
          console.log(`       → ${tasks.length} tasks`);
          auditData.tasks.push(...tasks);
        }
      }
    }
    
    // Analyze tasks
    console.log('\n📊 Analyzing tasks...');
    
    for (const task of auditData.tasks) {
      // Count by status
      const status = task.status?.status || 'Unknown';
      auditData.summary.tasksByStatus[status] = (auditData.summary.tasksByStatus[status] || 0) + 1;
      
      // Count by assignee
      if (task.assignees && task.assignees.length > 0) {
        for (const assignee of task.assignees) {
          const name = assignee.username || assignee.email || 'Unknown';
          auditData.summary.tasksByAssignee[name] = (auditData.summary.tasksByAssignee[name] || 0) + 1;
          auditData.assignees.add(name);
        }
      } else {
        auditData.summary.tasksByAssignee['Unassigned'] = (auditData.summary.tasksByAssignee['Unassigned'] || 0) + 1;
      }
      
      // Count by list
      const listKey = task._folderName ? `${task._folderName}/${task._listName}` : task._listName;
      auditData.summary.tasksByList[listKey] = (auditData.summary.tasksByList[listKey] || 0) + 1;
      
      // Count by folder
      if (task._folderName) {
        auditData.summary.tasksByFolder[task._folderName] = (auditData.summary.tasksByFolder[task._folderName] || 0) + 1;
      }
      
      // Due date analysis
      if (task.due_date) {
        auditData.summary.tasksWithDueDate++;
        if (parseInt(task.due_date) < now && task.status?.status !== 'closed' && task.status?.status !== 'complete') {
          auditData.summary.tasksOverdue++;
        }
      }
      
      // Priority
      const priority = task.priority?.priority || 'none';
      auditData.summary.tasksByPriority[priority] = (auditData.summary.tasksByPriority[priority] || 0) + 1;
      
      // Custom fields
      if (task.custom_fields) {
        for (const cf of task.custom_fields) {
          auditData.customFields.add(JSON.stringify({ name: cf.name, type: cf.type }));
          if (cf.value !== null && cf.value !== undefined && cf.value !== '') {
            auditData.summary.customFieldsUsed[cf.name] = (auditData.summary.customFieldsUsed[cf.name] || 0) + 1;
          }
        }
      }
      
      // Tags
      if (task.tags) {
        task.tags.forEach(t => auditData.tags.add(t.name));
      }
      
      // Subtasks
      if (task.parent) {
        auditData.summary.totalSubtasks++;
      } else {
        auditData.summary.totalTasks++;
      }
    }
    
    // Convert sets to arrays for JSON
    auditData.customFields = Array.from(auditData.customFields).map(s => JSON.parse(s));
    auditData.statuses = Array.from(auditData.statuses).map(s => JSON.parse(s));
    auditData.assignees = Array.from(auditData.assignees);
    auditData.tags = Array.from(auditData.tags);
    
    // Save full audit
    const fullPath = path.join(OUTPUT_DIR, 'clickup-full-audit.json');
    fs.writeFileSync(fullPath, JSON.stringify(auditData, null, 2));
    
    // Save summary report
    const summaryPath = path.join(OUTPUT_DIR, 'clickup-audit-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify({
      meta: auditData.meta,
      summary: auditData.summary,
      customFields: auditData.customFields,
      statuses: auditData.statuses,
      assignees: auditData.assignees,
      tags: auditData.tags,
      spaces: auditData.spaces,
      folders: auditData.folders,
      lists: auditData.lists
    }, null, 2));
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 CLICKUP AUDIT SUMMARY');
    console.log('='.repeat(60));
    console.log(`Spaces: ${auditData.summary.totalSpaces}`);
    console.log(`Folders: ${auditData.summary.totalFolders}`);
    console.log(`Lists: ${auditData.summary.totalLists}`);
    console.log(`Total Tasks: ${auditData.summary.totalTasks}`);
    console.log(`Subtasks: ${auditData.summary.totalSubtasks}`);
    console.log(`Tasks with Due Date: ${auditData.summary.tasksWithDueDate}`);
    console.log(`Overdue Tasks: ${auditData.summary.tasksOverdue}`);
    
    console.log('\n📈 Tasks by Status:');
    Object.entries(auditData.summary.tasksByStatus)
      .sort((a, b) => b[1] - a[1])
      .forEach(([status, count]) => console.log(`  ${status}: ${count}`));
    
    console.log('\n👥 Tasks by Assignee:');
    Object.entries(auditData.summary.tasksByAssignee)
      .sort((a, b) => b[1] - a[1])
      .forEach(([name, count]) => console.log(`  ${name}: ${count}`));
    
    console.log('\n📂 Tasks by Folder (Top 10):');
    Object.entries(auditData.summary.tasksByFolder)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([folder, count]) => console.log(`  ${folder}: ${count}`));
    
    console.log('\n🏷️ Custom Fields Used:');
    Object.entries(auditData.summary.customFieldsUsed)
      .sort((a, b) => b[1] - a[1])
      .forEach(([name, count]) => console.log(`  ${name}: ${count} tasks`));
    
    console.log(`\n✅ Full audit saved to: ${fullPath}`);
    console.log(`✅ Summary saved to: ${summaryPath}`);
    
  } catch (e) {
    console.error('❌ Error:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
})();
