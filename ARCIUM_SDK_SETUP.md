# Arcium SDK Setup Guide for NEXORA

This guide shows how to install and configure the official Arcium SDK for NEXORA prediction markets.

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Arcium account with API key ([Get one here](https://arcium.com))
- MXE enclave deployed (see [Deployment Guide](#mxe-enclave-deployment))

---

## Step 1: Install Official SDK Packages

Install the official Arcium SDK packages from npm:

```bash
cd /workspaces/nexora/app

# Install both client and reader packages
npm install @arcium-hq/client @arcium-hq/reader

# Verify installation
npm list @arcium-hq/client @arcium-hq/reader
```

**Expected output:**
```
@arcium-hq/client@x.x.x
@arcium-hq/reader@x.x.x
```

### TypeScript Support

Both packages include TypeScript definitions. Verify types are available:

```bash
ls node_modules/@arcium-hq/client/dist
ls node_modules/@arcium-hq/reader/dist
```

If types are missing, install them explicitly:

```bash
npm install --save-dev @types/arcium-hq__client @types/arcium-hq__reader
```

---

## Step 2: Configure Environment

Create **`app/.env.local`** with your Arcium configuration:

```bash
# Arcium Network Configuration
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
```

### Get Your API Key

1. Visit [Arcium Dashboard](https://dashboard.arcium.com)
2. Sign up or log in
3. Navigate to **API Keys**
4. Click **Create New Key**
5. Copy the key to your `.env.local`

**Security:** Never commit `.env.local` to git. It's already in `.gitignore`.

---

## Step 3: Verify Installation

Test that the SDK is properly installed and configured:

```bash
cd /workspaces/nexora/app
npm run dev
```

Check the browser console for:
```
✅ Arcium client initialized: testnet
```

If you see errors, verify:
1. All environment variables are set
2. API key is valid
3. Network value is correct (testnet, devnet, or mainnet)

---

## Step 4: Test SDK Connection

Create a test file to verify SDK connectivity:

**`app/src/__tests__/arcium-health.test.ts`:**

```typescript
import { createArciumService } from '../services/ArciumService';

async function testArciumConnection() {
  try {
    const service = createArciumService();
    const isHealthy = await service.healthCheck();
    
    if (isHealthy) {
      console.log('✅ Arcium SDK connected successfully');
    } else {
      console.error('❌ Arcium SDK health check failed');
    }
  } catch (error) {
    console.error('❌ Error connecting to Arcium:', error);
  }
}

testArciumConnection();
```

Run the test:
```bash
npx tsx app/src/__tests__/arcium-health.test.ts
```

---

## MXE Enclave Deployment

Before using the SDK with NEXORA, you need to deploy the MXE enclave.

### Option 1: Using Arcium CLI

```bash
# Install Arcium CLI
npm install -g @arcium-hq/cli

# Login to Arcium
arcium login

# Deploy enclave
cd /workspaces/nexora/mxe-programs/nexora-enclave
arcium deploy --network testnet

# Get enclave ID
arcium list-enclaves
```

### Option 2: Using Web Dashboard

1. Go to [Arcium Dashboard](https://dashboard.arcium.com)
2. Navigate to **Enclaves**
3. Click **Deploy New Enclave**
4. Upload your MXE program code
5. Select network (testnet/mainnet)
6. Copy the enclave ID
7. Update `.env.local` with the ID

---

## Integration Status Check

Run this command to verify everything is configured:

```bash
npm run arcium:check
```

Add this script to **`package.json`**:

```json
{
  "scripts": {
    "arcium:check": "tsx scripts/check-arcium-setup.ts"
  }
}
```

**`scripts/check-arcium-setup.ts`:**

```typescript
import { isArciumConfigured } from '../app/src/services/ArciumService';

const checks = [
  { name: 'VITE_ARCIUM_NETWORK', value: process.env.VITE_ARCIUM_NETWORK },
  { name: 'VITE_ARCIUM_API_KEY', value: process.env.VITE_ARCIUM_API_KEY ? '***' : undefined },
  { name: 'VITE_ARCIUM_MXE_ENCLAVE_ID', value: process.env.VITE_ARCIUM_MXE_ENCLAVE_ID },
];

console.log('🔍 Checking Arcium configuration...\n');

let allGood = true;
for (const check of checks) {
  const status = check.value ? '✅' : '❌';
  console.log(`${status} ${check.name}: ${check.value || 'NOT SET'}`);
  if (!check.value) allGood = false;
}

console.log('\n' + (allGood ? '✅ All configured!' : '❌ Missing configuration'));
console.log('\nSDK Configured:', isArciumConfigured() ? 'YES' : 'NO');
```

---

## Official Documentation

- **Installation Guide:** https://docs.arcium.com/developers/installation
- **API Reference:** https://docs.arcium.com/developers
- **TypeScript SDK API:** https://ts.arcium.com/api/
- **Hello World Tutorial:** https://docs.arcium.com/developers/hello-world
- **Node Setup:** https://docs.arcium.com/developers/node-setup
- **Deployment Guide:** https://docs.arcium.com/developers/deployment

---

## Package Details

### @arcium-hq/client

The client package is used for submitting computations to the MXE.

**Key Methods:**
- `submitComputation(params)` - Submit confidential computation
- `getComputationStatus(id)` - Check computation status
- `cancelComputation(id)` - Cancel pending computation

**Usage:**
```typescript
import { ArciumClient } from '@arcium-hq/client';

const client = new ArciumClient({
  network: 'testnet',
  apiKey: 'your_api_key',
});

const computation = await client.submitComputation({
  program: 'nexora_record_bet',
  input: JSON.stringify(betData),
  enclaveId: 'nexora_prediction_markets',
});
```

### @arcium-hq/reader

The reader package is used for reading computation results.

**Key Methods:**
- `readComputationResult(id)` - Read completed computation result
- `streamComputationResults(filter)` - Stream results as they complete

**Usage:**
```typescript
import { ArciumReader } from '@arcium-hq/reader';

const reader = new ArciumReader({
  network: 'testnet',
  apiKey: 'your_api_key',
});

const result = await reader.readComputationResult(computationId);
const output = JSON.parse(result.output);
```

---

## Troubleshooting

### "Cannot find module '@arcium-hq/client'"

**Solution:**
```bash
npm install @arcium-hq/client @arcium-hq/reader
```

### "Invalid API key"

**Solution:**
1. Check your API key in `.env.local`
2. Regenerate key from Arcium dashboard
3. Verify no extra whitespace in key

### "Network not supported"

**Solution:**
Use one of: `testnet`, `devnet`, `mainnet`

### "Enclave not found"

**Solution:**
1. Verify enclave is deployed
2. Check enclave ID is correct
3. Ensure network matches (testnet enclave on testnet network)

---

## Next Steps

After completing setup:

1. ✅ SDK packages installed
2. ✅ Environment configured
3. ✅ MXE enclave deployed
4. ✅ Health check passes

**Continue to:** [ARCIUM_SDK_IMPLEMENTATION.md](ARCIUM_SDK_IMPLEMENTATION.md) for full integration guide

---

**Need Help?**
- Arcium Discord: https://discord.gg/arcium
- Documentation: https://docs.arcium.com
- GitHub Issues: https://github.com/arcium-hq/sdk/issues
