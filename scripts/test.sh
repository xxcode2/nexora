#!/bin/bash

# NEXORA - Quick Test Script
# Runs the complete test suite

set -e

echo "🧪 NEXORA Test Suite"
echo "===================="
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    yarn install
    echo ""
fi

# Build program
echo "🔨 Building program..."
anchor build
echo ""

# Run tests
echo "🧪 Running Anchor tests..."
anchor test --skip-local-validator
echo ""

echo "✅ All tests passed!"
echo ""
