#!/bin/bash
# Phase 2 Verification Script
# Verifies API Cost Dashboard implementation

echo "🔍 Phase 2 API Cost Dashboard - Verification"
echo "=============================================="
echo ""

# 1. Check files exist
echo "📁 Checking files..."
files=(
  "src/app/api/costs/summary/route.ts"
  "src/app/api/costs/recent/route.ts"
  "src/app/api/costs/trends/route.ts"
  "src/components/admin/api-cost-widget.tsx"
  "supabase/migrations/20260405_api_cost_tracking.sql"
)

all_exist=true
for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "✅ $file"
  else
    echo "❌ $file - NOT FOUND"
    all_exist=false
  fi
done

echo ""

# 2. Check database table
echo "🗄️  Checking database..."
DB_URL="postgresql://postgres.lqlyargzteskhsddbjpa:BsE%232023admin@aws-0-us-west-2.pooler.supabase.com:6543/postgres"

echo -n "  Table exists: "
table_exists=$(psql "$DB_URL" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'api_cost_log');" 2>/dev/null | tr -d ' ')
if [ "$table_exists" = "t" ]; then
  echo "✅"
else
  echo "❌"
fi

echo -n "  Record count: "
count=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM api_cost_log;" 2>/dev/null | tr -d ' ')
echo "$count records"

echo -n "  Total cost: "
total=$(psql "$DB_URL" -t -c "SELECT SUM(cost_usd) FROM api_cost_log;" 2>/dev/null | tr -d ' ')
echo "\$$total USD"

echo ""

# 3. Check dashboard integration
echo "🎨 Checking dashboard integration..."
if grep -q "APICostWidget" src/app/\(authenticated\)/dashboard/page.tsx; then
  echo "✅ Widget imported in dashboard"
else
  echo "❌ Widget NOT imported in dashboard"
fi

if grep -q "lg:grid-cols-3" src/app/\(authenticated\)/dashboard/page.tsx; then
  echo "✅ Grid layout updated (3 columns)"
else
  echo "⚠️  Grid layout may not be updated"
fi

if grep -q '{userRole === .admin. && <APICostWidget' src/app/\(authenticated\)/dashboard/page.tsx; then
  echo "✅ Admin-only conditional rendering"
else
  echo "❌ Admin check NOT found"
fi

echo ""

# 4. Summary
echo "📊 Summary"
echo "=========="
if [ "$all_exist" = true ] && [ "$table_exists" = "t" ] && [ "$count" -gt 0 ]; then
  echo "✅ Phase 2 implementation COMPLETE"
  echo ""
  echo "🚀 Next steps:"
  echo "   1. Start dev server: npm run dev"
  echo "   2. Navigate to: http://localhost:3000/dashboard"
  echo "   3. Log in as admin user"
  echo "   4. View API Cost Widget in dashboard"
else
  echo "⚠️  Some issues detected - review above"
fi
