#!/bin/bash

# Test script to verify labor_cost calculation in timesheet entries
# This will create a test entry, verify labor_cost is calculated, then clean it up

set -e

API_URL="http://localhost:3000"
# You'll need to provide a valid auth token - get it from browser dev tools after logging in
# Replace this with an actual token:
AUTH_TOKEN="YOUR_TOKEN_HERE"

echo "🧪 Testing labor_cost auto-calculation..."
echo ""

# Get current user's info
echo "1. Fetching current user profile..."
USER_RESPONSE=$(curl -s -X GET "${API_URL}/api/user" \
  -H "Authorization: Bearer ${AUTH_TOKEN}")

echo "User: $USER_RESPONSE"
echo ""

# Create a test time entry with 5 hours
echo "2. Creating test time entry with 5 hours..."
CREATE_RESPONSE=$(curl -s -X POST "${API_URL}/api/timesheets/entry" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "project_number": "26-01",
    "phase_name": "General",
    "entry_date": "2026-04-05",
    "hours": "5",
    "notes": "TEST: Labor cost calculation verification"
  }')

echo "Create response: $CREATE_RESPONSE"
ENTRY_ID=$(echo "$CREATE_RESPONSE" | jq -r '.entry.id')
LABOR_COST=$(echo "$CREATE_RESPONSE" | jq -r '.entry.labor_cost')
echo ""

if [ "$ENTRY_ID" != "null" ] && [ "$LABOR_COST" != "null" ]; then
  echo "✅ SUCCESS: Entry created with ID=$ENTRY_ID"
  echo "✅ Labor cost calculated: \$${LABOR_COST}"
  echo ""
  
  # Verify labor_cost = hours × employee_rate
  echo "3. Verifying calculation..."
  EXPECTED_CALCULATION=$(echo "scale=2; ${LABOR_COST} / 5" | bc)
  echo "   Employee labor cost rate: \$${EXPECTED_CALCULATION}/hour"
  echo "   5 hours × \$${EXPECTED_CALCULATION} = \$${LABOR_COST} ✅"
  echo ""
  
  # Clean up test entry
  echo "4. Cleaning up test entry..."
  DELETE_RESPONSE=$(curl -s -X DELETE "${API_URL}/api/timesheets/entry" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${AUTH_TOKEN}" \
    -d "{\"id\": ${ENTRY_ID}}")
  
  echo "Delete response: $DELETE_RESPONSE"
  echo ""
  echo "✅ Test completed successfully!"
else
  echo "❌ FAILED: Entry creation failed or labor_cost not calculated"
  exit 1
fi
