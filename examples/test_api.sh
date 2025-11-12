#!/bin/bash

# Test script for AI CRM Expert API
BASE_URL="http://localhost:3000"

echo "🏥 Testing Health Check..."
curl -s "${BASE_URL}/api/health" | jq

echo ""
echo "📊 Testing Stats..."
curl -s "${BASE_URL}/api/stats" | jq

echo ""
echo "💬 Testing Message Generation..."
curl -s -X POST "${BASE_URL}/api/generate-message" \
  -H "Content-Type: application/json" \
  -d @examples/sample_context.json | jq

echo ""
echo "✅ Test complete!"
