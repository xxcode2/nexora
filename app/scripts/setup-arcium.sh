#!/bin/bash

# NEXORA - Arcium SDK Quick Setup Script
# This script installs the Arcium SDK packages and sets up configuration

set -e  # Exit on error

echo "🚀 NEXORA - Arcium SDK Setup"
echo "================================"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found"
    echo "Please run this script from /workspaces/nexora/app"
    exit 1
fi

echo "📦 Step 1: Installing Arcium SDK packages..."
echo ""

npm install @arcium-hq/client @arcium-hq/reader @noble/curves

echo ""
echo "✅ SDK packages installed successfully!"
echo ""

# Check if .env.local exists
if [ -f ".env.local" ]; then
    echo "⚠️  .env.local already exists. Skipping creation."
    echo ""
else
    echo "📝 Step 2: Creating .env.local template..."
    echo ""
    
    cat > .env.local << 'EOF'
# Arcium Configuration
VITE_ARCIUM_NETWORK=testnet
VITE_ARCIUM_API_KEY=your_api_key_here
VITE_ARCIUM_MXE_ENCLAVE_ID=nexora_prediction_markets

# Arcium Endpoint (optional - uses default if not set)
# VITE_ARCIUM_ENDPOINT=https://api.arcium.com

# Solana Configuration
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
VITE_PROGRAM_ID=Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS
VITE_ADMIN_PUBKEY=GveKcrXTsLd2nqSPgwV1BifPS1fJvoaP5AajpAXitxez
VITE_USDC_MINT=Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr
EOF
    
    echo "✅ .env.local template created"
    echo ""
fi

echo "================================"
echo "✅ Setup Complete!"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Get Arcium API Key:"
echo "   → Visit: https://dashboard.arcium.com"
echo "   → Create account / Login"
echo "   → Generate API key"
echo ""
echo "2. Update .env.local:"
echo "   → Open: .env.local"
echo "   → Replace 'your_api_key_here' with your actual API key"
echo ""
echo "3. Deploy MXE Enclave:"
echo "   → npm install -g @arcium-hq/cli"
echo "   → arcium login"
echo "   → arcium deploy --network testnet"
echo "   → Update VITE_ARCIUM_MXE_ENCLAVE_ID in .env.local"
echo ""
echo "4. Verify Configuration:"
echo "   → npm run arcium:check"
echo ""
echo "5. Start Development:"
echo "   → npm run dev"
echo ""
echo "📖 Documentation:"
echo "   → Setup Guide: ../ARCIUM_SDK_SETUP.md"
echo "   → Implementation: ../ARCIUM_SDK_IMPLEMENTATION.md"
echo ""
echo "🎉 Ready to integrate Arcium SDK!"
