/**
 * ClickUp Workflow Mapper
 * Analyzes task patterns to document workflows
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data/clickup-audit');
const auditData = require(path.join(DATA_DIR, 'clickup-full-audit.json'));

function analyzePermitWorkflow() {
  console.log('\n=== PERMIT WORKFLOW ANALYSIS ===\n');
  
  // Get all permit tasks
  const permitTasks = auditData.tasks.filter(t => t._listName === 'Permits');
  const parentPermitTasks = permitTasks.filter(t => !t.parent);
  const permitSubtasks = permitTasks.filter(t => t.parent);
  
  console.log(`Total Permit Tasks: ${permitTasks.length}`);
  console.log(`  Parent Tasks: ${parentPermitTasks.length}`);
  console.log(`  Subtasks: ${permitSubtasks.length}`);
  
  // Analyze subtask naming patterns
  const subtaskPatterns = {};
  permitSubtasks.forEach(t => {
    // Normalize task names to find patterns
    let pattern = t.name
      .replace(/\d+(st|nd|rd|th)/g, 'Nth')
      .replace(/\d+/g, '#');
    subtaskPatterns[pattern] = (subtaskPatterns[pattern] || 0) + 1;
  });
  
  console.log('\nCommon Permit Subtask Patterns:');
  Object.entries(subtaskPatterns)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([pattern, count]) => {
      console.log(`  "${pattern}": ${count}`);
    });
  
  // Analyze permit status field usage
  const permitStatuses = {};
  permitTasks.forEach(t => {
    const cf = t.custom_fields?.find(c => c.name === 'Permit Status');
    if (cf?.value != null && cf.type_config?.options) {
      const status = cf.type_config.options.find(o => o.orderindex === cf.value);
      if (status) {
        permitStatuses[status.name] = (permitStatuses[status.name] || 0) + 1;
      }
    }
  });
  
  console.log('\nPermit Status Distribution:');
  Object.entries(permitStatuses)
    .sort((a, b) => b[1] - a[1])
    .forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
  
  // Analyze agency distribution in permits
  const agencies = {};
  permitTasks.forEach(t => {
    const cf = t.custom_fields?.find(c => c.name === 'Agency');
    if (cf?.value != null && cf.type_config?.options) {
      const agency = cf.type_config.options.find(o => o.orderindex === cf.value);
      if (agency) {
        agencies[agency.name] = (agencies[agency.name] || 0) + 1;
      }
    }
  });
  
  console.log('\nAgency Distribution in Permits:');
  Object.entries(agencies)
    .sort((a, b) => b[1] - a[1])
    .forEach(([agency, count]) => {
      console.log(`  ${agency}: ${count}`);
    });
}

function analyzeSubmittalWorkflow() {
  console.log('\n=== SUBMITTAL WORKFLOW ANALYSIS ===\n');
  
  const submittalTasks = auditData.tasks.filter(t => t._listName === 'Submittals');
  const parentTasks = submittalTasks.filter(t => !t.parent);
  const subtasks = submittalTasks.filter(t => t.parent);
  
  console.log(`Total Submittal Tasks: ${submittalTasks.length}`);
  console.log(`  Parent Tasks: ${parentTasks.length}`);
  console.log(`  Subtasks: ${subtasks.length}`);
  
  // Common submittal task names
  const taskNames = {};
  parentTasks.forEach(t => {
    let name = t.name.replace(/\d{2}-\d{2}/g, 'XX-XX');
    taskNames[name] = (taskNames[name] || 0) + 1;
  });
  
  console.log('\nCommon Submittal Task Names:');
  Object.entries(taskNames)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([name, count]) => {
      console.log(`  "${name}": ${count}`);
    });
  
  // Signature requirements
  const signatures = {};
  submittalTasks.forEach(t => {
    const cf = t.custom_fields?.find(c => c.name === 'Signature');
    if (cf?.value != null && cf.type_config?.options) {
      const sig = cf.type_config.options.find(o => o.orderindex === cf.value);
      if (sig) {
        signatures[sig.name] = (signatures[sig.name] || 0) + 1;
      }
    }
  });
  
  console.log('\nSignature Requirements:');
  Object.entries(signatures)
    .forEach(([sig, count]) => {
      console.log(`  ${sig}: ${count}`);
    });
}

function analyzeCAWorkflow() {
  console.log('\n=== CONSTRUCTION ADMINISTRATION WORKFLOW ===\n');
  
  const caTasks = auditData.tasks.filter(t => t._listName === 'CA');
  const parentTasks = caTasks.filter(t => !t.parent);
  const subtasks = caTasks.filter(t => t.parent);
  
  console.log(`Total CA Tasks: ${caTasks.length}`);
  console.log(`  Parent Tasks: ${parentTasks.length}`);
  console.log(`  Subtasks: ${subtasks.length}`);
  
  // Which projects have CA lists
  const caProjects = new Set(caTasks.map(t => t._folderName).filter(Boolean));
  console.log(`\nProjects with CA Lists (${caProjects.size}):`);
  caProjects.forEach(p => console.log(`  ${p}`));
  
  // Common CA task patterns
  const taskPatterns = {};
  caTasks.forEach(t => {
    let pattern = t.name
      .replace(/\d{2}[-/]\d{2}[-/]\d{2,4}/g, 'DATE')
      .replace(/\d+/g, '#');
    taskPatterns[pattern] = (taskPatterns[pattern] || 0) + 1;
  });
  
  console.log('\nCommon CA Task Patterns:');
  Object.entries(taskPatterns)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([pattern, count]) => {
      console.log(`  "${pattern}": ${count}`);
    });
}

function analyzeCloseoutWorkflow() {
  console.log('\n=== CLOSEOUT WORKFLOW ANALYSIS ===\n');
  
  const closeoutTasks = auditData.tasks.filter(t => t._listName === 'Closeout');
  const parentTasks = closeoutTasks.filter(t => !t.parent);
  const subtasks = closeoutTasks.filter(t => t.parent);
  
  console.log(`Total Closeout Tasks: ${closeoutTasks.length}`);
  console.log(`  Parent Tasks: ${parentTasks.length}`);
  console.log(`  Subtasks: ${subtasks.length}`);
  
  // Common closeout task names (these become templates)
  const taskNames = {};
  parentTasks.forEach(t => {
    taskNames[t.name] = (taskNames[t.name] || 0) + 1;
  });
  
  console.log('\nCloseout Task Template Candidates:');
  Object.entries(taskNames)
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, count]) => {
      console.log(`  "${name}": ${count}`);
    });
}

function analyzeTimePatterns() {
  console.log('\n=== TIME & DURATION ANALYSIS ===\n');
  
  const tasksWithDuration = auditData.tasks.filter(t => {
    const cf = t.custom_fields?.find(c => c.name === 'Duration');
    return cf?.value != null;
  });
  
  console.log(`Tasks with Duration field: ${tasksWithDuration.length}`);
  
  // Duration distribution by list type
  const durationByList = {};
  tasksWithDuration.forEach(t => {
    const cf = t.custom_fields.find(c => c.name === 'Duration');
    const duration = parseInt(cf.value) || 0;
    if (!durationByList[t._listName]) {
      durationByList[t._listName] = { total: 0, count: 0, max: 0, min: Infinity };
    }
    durationByList[t._listName].total += duration;
    durationByList[t._listName].count++;
    durationByList[t._listName].max = Math.max(durationByList[t._listName].max, duration);
    durationByList[t._listName].min = Math.min(durationByList[t._listName].min, duration);
  });
  
  console.log('\nAverage Duration by List Type:');
  Object.entries(durationByList)
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([list, stats]) => {
      const avg = (stats.total / stats.count).toFixed(1);
      console.log(`  ${list}: avg ${avg} days (${stats.count} tasks, min ${stats.min}, max ${stats.max})`);
    });
}

function generateReport() {
  console.log('='.repeat(60));
  console.log('CLICKUP WORKFLOW ANALYSIS REPORT');
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log('='.repeat(60));
  
  analyzePermitWorkflow();
  analyzeSubmittalWorkflow();
  analyzeCAWorkflow();
  analyzeCloseoutWorkflow();
  analyzeTimePatterns();
  
  console.log('\n' + '='.repeat(60));
  console.log('END OF REPORT');
  console.log('='.repeat(60));
}

generateReport();
