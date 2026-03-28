const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ahpsnajqjosjasaqebpd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFocHNuYWpxam9zamFzYXFlYnBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzEzNDYsImV4cCI6MjA4NjUwNzM0Nn0.lQoCSoveBS4gJOvg3ynsLhZzCc2KiZD0YpoVy2Yb_LA'
);

async function investigateInvoiceStatus() {
  console.log('🔍 Investigating Invoice Status Issue\n');
  console.log('='.repeat(80) + '\n');
  
  // Get sample invoices
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('invoice_number, project_number, date_issued, amount, status, date_paid')
    .order('date_issued', { ascending: false })
    .limit(20);
  
  if (error) {
    console.error('❌ Error fetching invoices:', error.message);
    return;
  }
  
  console.log('📊 Sample of 20 recent invoices:\n');
  
  let paidCount = 0;
  let unpaidCount = 0;
  let withDatePaid = 0;
  
  invoices.forEach(inv => {
    const hasPaidDate = inv.date_paid !== null;
    const status = inv.status || 'null';
    
    if (status === 'paid') paidCount++;
    if (status === 'unpaid') unpaidCount++;
    if (hasPaidDate) withDatePaid++;
    
    console.log(`Invoice: ${inv.invoice_number}`);
    console.log(`  Amount: $${inv.amount?.toFixed(2) || '0.00'}`);
    console.log(`  Status: "${status}"`);
    console.log(`  Date Paid: ${inv.date_paid || 'NULL'}`);
    console.log(`  ⚠️  Mismatch: ${hasPaidDate && status === 'unpaid' ? 'YES - has date_paid but status=unpaid!' : 'No'}`);
    console.log('');
  });
  
  console.log('\n📈 Summary:');
  console.log(`  Total sampled: ${invoices.length}`);
  console.log(`  Status = "paid": ${paidCount}`);
  console.log(`  Status = "unpaid": ${unpaidCount}`);
  console.log(`  Has date_paid value: ${withDatePaid}`);
  console.log(`  Status = null/other: ${invoices.length - paidCount - unpaidCount}`);
  
  // Get totals from database
  console.log('\n💰 Financial Totals:\n');
  
  const { data: totals } = await supabase
    .from('invoices')
    .select('amount, status, date_paid');
  
  let totalRevenue = 0;
  let totalPaid = 0;
  let totalUnpaid = 0;
  let hasPaidDateCount = 0;
  
  totals.forEach(inv => {
    totalRevenue += inv.amount || 0;
    if (inv.date_paid) {
      hasPaidDateCount++;
      totalPaid += inv.amount || 0;
    } else {
      totalUnpaid += inv.amount || 0;
    }
  });
  
  console.log(`  Total Invoices: ${totals.length}`);
  console.log(`  Total Revenue: $${totalRevenue.toFixed(2)}`);
  console.log(`  Invoices with date_paid: ${hasPaidDateCount} ($${totalPaid.toFixed(2)})`);
  console.log(`  Invoices without date_paid: ${totals.length - hasPaidDateCount} ($${totalUnpaid.toFixed(2)})`);
  
  // Check if status field is even being used
  const statusValues = new Set(totals.map(i => i.status));
  console.log(`\n  Unique status values in DB: ${Array.from(statusValues).join(', ')}`);
  
  console.log('\n🔍 ROOT CAUSE ANALYSIS:');
  if (unpaidCount === invoices.length && withDatePaid > 0) {
    console.log('  ❌ All invoices have status="unpaid" even when date_paid exists!');
    console.log('  ❌ The "status" field is not being calculated from date_paid');
    console.log('  ❌ Likely: QB sync sets status to "unpaid" by default and never updates it');
  } else if (paidCount === 0 && withDatePaid > 0) {
    console.log('  ❌ No invoices have status="paid" but some have date_paid');
    console.log('  ❌ Status field is not being set correctly');
  }
}

investigateInvoiceStatus().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
