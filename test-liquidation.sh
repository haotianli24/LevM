#!/bin/bash

BASE_URL="http://localhost:3000"
USER_ADDRESS="9wFFyRfZBsuAha4YcuxcXLKwMxJR43S7fPfQLusDBzvT"

echo "========================================="
echo "Testing Liquidation System"
echo "========================================="
echo ""

echo "Test 1: Create LONG position WITH maintenance margin"
echo "Entry: $0.50, Leverage: 10x, Collateral: $100, Maintenance: 6%"
echo "Expected liquidation price: ~$0.48"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/positions/create" \
  -H "Content-Type: application/json" \
  -d '{
    "marketId": "test-market-1",
    "marketName": "Test Market 1",
    "side": "long",
    "entryPrice": 0.50,
    "collateral": 100,
    "leverage": 10,
    "maintenanceMargin": 0.06,
    "userAddress": "'$USER_ADDRESS'"
  }')
echo "$RESPONSE" | python3 -m json.tool
POSITION_1=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['position']['id'])" 2>/dev/null)
echo "Position ID: $POSITION_1"
echo ""

echo "Test 2: Create LONG position WITHOUT maintenance margin"
echo "Entry: $0.50, Leverage: 10x, Collateral: $100, No maintenance"
echo "Expected liquidation price: $0.45"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/positions/create" \
  -H "Content-Type: application/json" \
  -d '{
    "marketId": "test-market-2",
    "marketName": "Test Market 2",
    "side": "long",
    "entryPrice": 0.50,
    "collateral": 100,
    "leverage": 10,
    "maintenanceMargin": null,
    "userAddress": "'$USER_ADDRESS'"
  }')
echo "$RESPONSE" | python3 -m json.tool
POSITION_2=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['position']['id'])" 2>/dev/null)
echo "Position ID: $POSITION_2"
echo ""

echo "Test 3: Create SHORT position WITH maintenance margin"
echo "Entry: $0.60, Leverage: 5x, Collateral: $200, Maintenance: 7%"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/positions/create" \
  -H "Content-Type: application/json" \
  -d '{
    "marketId": "test-market-3",
    "marketName": "Test Market 3",
    "side": "short",
    "entryPrice": 0.60,
    "collateral": 200,
    "leverage": 5,
    "maintenanceMargin": 0.07,
    "userAddress": "'$USER_ADDRESS'"
  }')
echo "$RESPONSE" | python3 -m json.tool
POSITION_3=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['position']['id'])" 2>/dev/null)
echo "Position ID: $POSITION_3"
echo ""

sleep 1

echo "Test 4: List user positions"
curl -s "$BASE_URL/api/positions/list?userAddress=$USER_ADDRESS" | python3 -m json.tool
echo ""

echo "Test 5: Monitor all positions (should be healthy)"
curl -s "$BASE_URL/api/liquidations/monitor" | python3 -m json.tool
echo ""

echo "Test 6: Update price to trigger liquidation on Position 1"
echo "Updating test-market-1 price to $0.47 (below liquidation price ~$0.48)"
curl -s -X POST "$BASE_URL/api/positions/update-price" \
  -H "Content-Type: application/json" \
  -d '{
    "marketId": "test-market-1",
    "newPrice": 0.47
  }' | python3 -m json.tool
echo ""

echo "Test 7: Monitor positions (Position 1 should be at risk)"
curl -s "$BASE_URL/api/liquidations/monitor" | python3 -m json.tool
echo ""

echo "Test 8: Execute liquidation check on all positions"
curl -s -X POST "$BASE_URL/api/liquidations/check-all" | python3 -m json.tool
echo ""

echo "Test 9: Update price to trigger liquidation on Position 2"
echo "Updating test-market-2 price to $0.44 (below liquidation price $0.45)"
curl -s -X POST "$BASE_URL/api/positions/update-price" \
  -H "Content-Type: application/json" \
  -d '{
    "marketId": "test-market-2",
    "newPrice": 0.44
  }' | python3 -m json.tool
echo ""

echo "Test 10: Execute liquidation check again"
curl -s -X POST "$BASE_URL/api/liquidations/check-all" | python3 -m json.tool
echo ""

echo "Test 11: Close Position 3 manually"
if [ ! -z "$POSITION_3" ]; then
  curl -s -X POST "$BASE_URL/api/positions/close" \
    -H "Content-Type: application/json" \
    -d '{
      "positionId": "'$POSITION_3'",
      "userAddress": "'$USER_ADDRESS'"
    }' | python3 -m json.tool
fi
echo ""

echo "Test 12: Final position list"
curl -s "$BASE_URL/api/positions/list?userAddress=$USER_ADDRESS" | python3 -m json.tool
echo ""

echo "========================================="
echo "All tests completed!"
echo "========================================="
