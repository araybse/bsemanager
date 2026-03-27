#!/bin/bash
# Test script for verifying invoice deletion sync

echo "🧪 Testing Invoice Deletion Sync"
echo "================================="
echo ""
echo "Steps to test:"
echo "1. Open QuickBooks and delete invoice 27-xx-xx (if not already deleted)"
echo "2. Open IRIS at https://bsemanager.vercel.app/settings"
echo "3. Click 'Sync All' button"
echo "4. Wait for sync to complete"
echo "5. Run this script to verify"
echo ""
read -p "Press Enter when you've completed the sync..."
echo ""
echo "Checking invoice status in database..."
echo ""

cd "$(dirname "$0")/.."
node -e "
import('file://' + process.cwd() + '/scripts/check-deleted.mjs').catch(err => {
  console.log('❌ Could not run check. Verify .env.local has:');
  console.log('   - NEXT_PUBLIC_SUPABASE_URL');
  console.log('   - SUPABASE_SERVICE_ROLE_KEY');
  console.log('');
  console.log('Error:', err.message);
  process.exit(1);
});
"

echo ""
echo "✅ Test complete!"
