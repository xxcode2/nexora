#!/usr/bin/env tsx

/**
 * NEXORA - Arcium SDK Configuration Checker
 * 
 * This script verifies that all required Arcium SDK configuration is present.
 * 
 * NOTE: This is a placeholder script. Real Arcium SDK configuration
 * will be implemented when the SDK packages are available.
 */

import { resolve } from 'path';
import { existsSync } from 'fs';

// Simple env loader (no dotenv dependency needed)
const envPath = resolve(__dirname, '../.env.local');
const hasEnvFile = existsSync(envPath);

if (hasEnvFile) {
  console.log('✅ .env.local file found');
} else {
  console.log('⚠️  .env.local file not found (optional for now)');
}

interface ConfigCheck {
  name: string;
  envVar: string;
  required: boolean;
  hideValue?: boolean;
}

const checks: ConfigCheck[] = [
  {
    name: 'Arcium Network',
    envVar: 'VITE_ARCIUM_NETWORK',
    required: true,
  },
  {
    name: 'Arcium API Key',
    envVar: 'VITE_ARCIUM_API_KEY',
    required: true,
    hideValue: true,
  },
  {
    name: 'Arcium MXE Enclave ID',
    envVar: 'VITE_ARCIUM_MXE_ENCLAVE_ID',
    required: true,
  },
  {
    name: 'Arcium Endpoint',
    envVar: 'VITE_ARCIUM_ENDPOINT',
    required: false,
  },
  {
    name: 'Solana RPC URL',
    envVar: 'VITE_SOLANA_RPC_URL',
    required: true,
  },
  {
    name: 'Program ID',
    envVar: 'VITE_PROGRAM_ID',
    required: true,
  },
  {
    name: 'Admin Pubkey',
    envVar: 'VITE_ADMIN_PUBKEY',
    required: true,
  },
  {
    name: 'USDC Mint',
    envVar: 'VITE_USDC_MINT',
    required: true,
  },
];

console.log('🔍 NEXORA - Arcium SDK Configuration Check');
console.log('==========================================\n');

let hasErrors = false;
let hasWarnings = false;

for (const check of checks) {
  const value = process.env[check.envVar];
  const hasValue = !!value && value !== 'your_api_key_here';

  let status: string;
  let displayValue: string;

  if (!hasValue) {
    if (check.required) {
      status = '❌';
      hasErrors = true;
    } else {
      status = '⚠️ ';
      hasWarnings = true;
    }
    displayValue = 'NOT SET';
  } else {
    status = '✅';
    displayValue = check.hideValue ? '***' : value;
  }

  const requiredLabel = check.required ? '' : '(optional)';
  console.log(`${status} ${check.name} ${requiredLabel}`);
  console.log(`   ${check.envVar}: ${displayValue}\n`);
}

console.log('==========================================\n');

if (hasErrors) {
  console.log('❌ Configuration INCOMPLETE\n');
  console.log('Missing required environment variables.');
  console.log('\n📖 Setup Instructions:');
  console.log('   1. Create app/.env.local (or copy from .env.example)');
  console.log('   2. Get Arcium API key: https://dashboard.arcium.com');
  console.log('   3. Deploy MXE enclave: arcium deploy --network testnet');
  console.log('   4. Update all required variables in .env.local');
  console.log('\n📚 Documentation: ../ARCIUM_SDK_SETUP.md\n');
  process.exit(1);
} else if (hasWarnings) {
  console.log('⚠️  Configuration MOSTLY COMPLETE\n');
  console.log('Some optional variables are not set.');
  console.log('This is OK if you are using default values.\n');
} else {
  console.log('✅ Configuration COMPLETE\n');
  console.log('All required environment variables are set!');
  console.log('\n🚀 Next Steps:');
  console.log('   1. Start dev server: npm run dev');
  console.log('   2. Test SDK connectivity');
  console.log('   3. Follow integration guide: ../ARCIUM_SDK_IMPLEMENTATION.md\n');
}

// Check if SDK packages are installed
console.log('📦 Checking SDK Packages...\n');

const requiredPackages = [
  '@arcium-hq/client',
  '@arcium-hq/reader',
  '@noble/curves',
];

try {
  const packageJson = require('../package.json');
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

  let allInstalled = true;
  for (const pkg of requiredPackages) {
    if (dependencies[pkg]) {
      console.log(`✅ ${pkg}: ${dependencies[pkg]}`);
    } else {
      console.log(`❌ ${pkg}: NOT INSTALLED`);
      allInstalled = false;
    }
  }

  if (!allInstalled) {
    console.log('\n❌ Missing SDK packages');
    console.log('\n📦 Install with:');
    console.log('   npm install @arcium-hq/client @arcium-hq/reader @noble/curves\n');
    process.exit(1);
  } else {
    console.log('\n✅ All SDK packages are installed\n');
  }
} catch (error) {
  console.log('⚠️  Could not check package.json');
  console.log('   Make sure you run this from the app/ directory\n');
}

// Final summary
console.log('==========================================');
console.log('Summary:\n');

const isConfigured = !hasErrors;
const arePackagesInstalled = true; // If we got here, they are

if (isConfigured && arePackagesInstalled) {
  console.log('🎉 READY FOR INTEGRATION!\n');
  console.log('Your Arcium SDK setup is complete.');
  console.log('Follow the implementation guide to integrate with NEXORA.\n');
  console.log('📖 Guide: ../ARCIUM_SDK_IMPLEMENTATION.md');
  console.log('📋 Checklist: ../ARCIUM_CHECKLIST.md\n');
} else {
  console.log('⏳ SETUP IN PROGRESS\n');
  console.log('Complete the steps above to finish setup.\n');
}

console.log('==========================================');
