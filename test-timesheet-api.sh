#!/bin/bash

# Test script for Timesheet API endpoints
# Run this after logging in to the app to get a valid session cookie

BASE_URL="http://localhost:3000"

# Calculate current week's Saturday (week ending date)
# This is a simplified version - adjust as needed
CURRENT_WEEK_SATURDAY=$(date -v+sat +%Y-%m-%d 2>/dev/null || date -d "next saturday" +%Y-%m-%d)

echo "Testing Timesheet API endpoints..."
echo "Week ending date: $CURRENT_WEEK_SATURDAY"
echo ""

echo "1. Testing GET /api/timesheets/[week]"
curl -s "${BASE_URL}/api/timesheets/${CURRENT_WEEK_SATURDAY}" | jq '.' || echo "Failed"
echo ""

echo "2. Testing POST /api/timesheets/entry (create)"
curl -s -X POST "${BASE_URL}/api/timesheets/entry" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": 1,
    "project_number": "26-01",
    "phase_name": "Design",
    "entry_date": "2026-04-07",
    "hours": 8,
    "notes": "Test entry - working on design documentation"
  }' | jq '.' || echo "Failed"
echo ""

echo "3. Testing POST /api/timesheets/copy-week"
curl -s -X POST "${BASE_URL}/api/timesheets/copy-week" \
  -H "Content-Type: application/json" \
  -d "{
    \"targetWeekEndingDate\": \"${CURRENT_WEEK_SATURDAY}\"
  }" | jq '.' || echo "Failed"
echo ""

echo "All tests completed!"
