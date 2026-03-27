#!/bin/bash

echo "🧪 BSE Manager Deployment Test Suite"
echo "======================================"
echo ""

BASE_URL="https://bsemanager.vercel.app"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

test_count=0
pass_count=0

test_route() {
  test_count=$((test_count + 1))
  local route="$1"
  local expected_code="$2"
  local description="$3"
  
  echo -n "Test $test_count: $description... "
  
  status=$(curl -s -o /dev/null -w "%{http_code}" -L "$BASE_URL$route")
  
  if [ "$status" = "$expected_code" ]; then
    echo -e "${GREEN}✓${NC} (HTTP $status)"
    pass_count=$((pass_count + 1))
  else
    echo -e "${RED}✗${NC} (Expected $expected_code, got $status)"
  fi
}

echo "🌐 Frontend Route Tests"
echo "-----------------------"
test_route "/" "200" "Login page loads"
test_route "/dashboard" "307" "Dashboard redirects when not authenticated"
test_route "/projects" "307" "Projects page redirects when not authenticated"
test_route "/timesheet" "307" "Timesheet page redirects when not authenticated"
test_route "/api/nonexistent" "404" "Non-existent API route returns 404"

echo ""
echo "📊 Results: $pass_count/$test_count tests passed"

if [ $pass_count -eq $test_count ]; then
  echo -e "${GREEN}✨ All tests passed!${NC}"
  exit 0
else
  echo -e "${YELLOW}⚠️  Some tests failed${NC}"
  exit 1
fi
