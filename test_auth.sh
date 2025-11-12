#!/bin/bash

# Get login response
LOGIN_RESPONSE=$(curl -s --ipv4 -X POST http://127.0.0.1:8000/api/v1/auth/login/ -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}')

# Extract access token
TOKEN=$(echo "$LOGIN_RESPONSE" | python -c "import sys, json; print(json.load(sys.stdin)['access'])")

echo "Testing authenticated request with JWT token..."
echo "Token (first 50 chars): ${TOKEN:0:50}..."
echo ""

# Test authenticated endpoint
curl -s --ipv4 -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8000/api/v1/auth/me/ | python -m json.tool

echo ""
echo "Testing API endpoint: /api/v1/clients/"
curl -s --ipv4 -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8000/api/v1/clients/ | python -m json.tool | head -30
