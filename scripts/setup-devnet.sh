#!/bin/bash

# NEXORA - Devnet Setup Script
# This script automates the initial setup for NEXORA on Solana Devnet

set -e

echo "🚀 NEXORA Devnet Setup"
echo "======================="
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

command -v solana >/dev/null 2>&1 || { echo "❌ Solana CLI not found. Install from https://docs.solana.com/cli/install-solana-cli-tools"; exit 1; }
command -v anchor >/dev/null 2>&1 || { echo "❌ Anchor CLI not found. Install from https://www.anchor-lang.com/docs/installation"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ Node.js not found. Install from https://nodejs.org"; exit 1; }
command -v yarn >/dev/null 2>&1 || { echo "❌ Yarn not found. Install with: npm install -g yarn"; exit 1; }

echo "✅ All prerequisites found"
echo ""

# Configure Solana for devnet
echo "🔧 Configuring Solana for Devnet..."
solana config set --url https://api.devnet.solana.com
echo ""

# Check balance
echo "💰 Checking SOL balance..."
BALANCE=$(solana balance 2>/dev/null | awk '{print $1}')

if (( $(echo "$BALANCE < 2" | bc -l) )); then
    echo "📡 Airdropping 2 SOL..."
    solana airdrop 2
else
    echo "✅ Balance: $BALANCE SOL"
fi
echo ""

# Build program
echo "🔨 Building Anchor program..."
anchor build
echo ""

# Get program ID
PROGRAM_ID=$(solana address -k target/deploy/nexora-keypair.json)
echo "📋 Program ID: $PROGRAM_ID"
echo ""

# Check if program IDs match
echo "⚠️  IMPORTANT: Update the following files with your Program ID:"
echo "   - Anchor.toml (programs.devnet.nexora)"
echo "   - programs/nexora/src/lib.rs (declare_id!)"
echo "   - app/src/contexts/NexoraContext.tsx (PROGRAM_ID)"
echo ""
read -p "Press Enter after updating these files..."
echo ""

# Rebuild after ID update
echo "🔨 Rebuilding with updated Program ID..."
anchor build
echo ""

# Deploy
echo "🚀 Deploying to Devnet..."
anchor deploy
echo ""

# Verify deployment
echo "✅ Verifying deployment..."
solana program show $PROGRAM_ID
echo ""

# Create test USDC token
echo "💵 Creating test USDC token..."
spl-token create-token --decimals 6 > /tmp/nexora-usdc.txt
USDC_MINT=$(grep "Creating token" /tmp/nexora-usdc.txt | awk '{print $3}')
echo "📋 USDC Mint: $USDC_MINT"
echo ""

# Create token account
echo "💳 Creating token account..."
spl-token create-account $USDC_MINT
echo ""

# Mint tokens
echo "💰 Minting 1000 test USDC..."
spl-token mint $USDC_MINT 1000
echo ""

echo "⚠️  IMPORTANT: Update USDC_MINT in:"
echo "   - app/src/contexts/NexoraContext.tsx"
echo ""

# Copy IDL
echo "📄 Copying IDL to frontend..."
mkdir -p app/src/idl
cp target/idl/nexora.json app/src/idl/nexora.json
echo ""

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd app
yarn install
echo ""

# Summary
echo "✅ Setup Complete!"
echo "==================="
echo ""
echo "📋 Next Steps:"
echo "   1. Update Program ID in all files (see above)"
echo "   2. Update USDC_MINT in NexoraContext.tsx"
echo "   3. Start frontend: cd app && yarn dev"
echo "   4. Connect Phantom wallet (set to Devnet)"
echo "   5. Create markets and place bets!"
echo ""
echo "🔗 Your Configuration:"
echo "   Program ID: $PROGRAM_ID"
echo "   USDC Mint: $USDC_MINT"
echo "   Network: Devnet"
echo ""
echo "💡 Tip: Save these values for future reference"
echo ""
