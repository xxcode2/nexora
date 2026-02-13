# Arcium SDK Integration Migration Guide

## Overview

This guide provides step-by-step instructions for migrating from the **current mock implementation** (base64 encoding) to **real Arcium SDK integration** with MXE confidential computing.

**Current State:** 15% complete (architecture only, no real encryption)  
**Target State:** 100% complete (full MXE integration with TEE confidentiality)

---

## Prerequisites

Before starting integration, you MUST obtain:

1. **Official Arcium SDK Documentation**
   - Installation instructions
   - API reference
   - Authentication guide
   - Example code

2. **Arcium Access Credentials**
   - MXE endpoint URL (devnet/mainnet)
   - API key or authentication token
   - Network-specific configuration

3. **Test Environment**
   - Arcium devnet access
   - Test wallet with devnet SOL
   - MXE enclave deployment

---

## Migration Steps

### Step 1: Install Official Arcium SDK

```bash
cd /workspaces/nexora/app

# 🚨 REPLACE WITH ACTUAL PACKAGE NAME
# Example (verify with official docs):
npm install @arcium/sdk
# OR
npm install arcium-confidential-compute
# OR whatever the official package name is
```

**Verification:**
```bash
npm list @arcium/sdk
```

---

### Step 2: Update SDK Client Implementation

**File:** [app/src/lib/arcium-sdk-client.ts](app/src/lib/arcium-sdk-client.ts)

Replace all 🚨 placeholder methods with real SDK calls:

#### 2.1 Import Real SDK

```typescript
// BEFORE (current placeholder):
type ArciumClient = any;

// AFTER (replace with official import):
import { ArciumClient, EncryptionConfig } from '@arcium/sdk'; // Example
```

#### 2.2 Initialize Client

```typescript
// BEFORE:
constructor(config: ArciumSDKConfig) {
  this.config = config;
  console.warn('⚠️ Using PLACEHOLDER Arcium client');
}

// AFTER (use official initialization):
constructor(config: ArciumSDKConfig) {
  this.config = config;
  this.client = new ArciumClient({
    endpoint: config.mxeEndpoint,
    network: config.networkId,
    apiKey: config.authToken, // If required
  });
}
```

#### 2.3 Implement encryptBet()

```typescript
// BEFORE:
throw new Error('encryptBet() requires official Arcium SDK');

// AFTER (use official encryption method):
async encryptBet(payload: { /* ... */ }): Promise<EncryptedPayload> {
  const plaintext = JSON.stringify(payload);
  
  const encrypted = await this.client.encrypt(plaintext, {
    associatedData: payload.market, // Bind encryption to market
  });
  
  return {
    ciphertext: encrypted.ciphertext,
    nonce: encrypted.nonce,
    keyInfo: encrypted.keyInfo,
  };
}
```

#### 2.4 Implement submitBetToMXE()

```typescript
// BEFORE:
throw new Error('submitBetToMXE() requires official Arcium SDK');

// AFTER:
async submitBetToMXE(
  encrypted: EncryptedPayload,
  metadata: { market: string; user: string }
): Promise<MXESubmissionResult> {
  const result = await this.client.submitToMXE({
    operation: 'RECORD_BET',
    encryptedData: encrypted.ciphertext,
    nonce: encrypted.nonce,
    metadata: {
      marketId: metadata.market,
      userPubkey: metadata.user,
    },
  });
  
  return {
    transactionId: result.txId,
    proof: result.proof,
    timestamp: result.timestamp,
  };
}
```

#### 2.5 Implement requestPayout()

```typescript
// BEFORE:
throw new Error('requestPayout() requires official Arcium SDK');

// AFTER:
async requestPayout(request: PayoutRequest): Promise<PayoutResponse> {
  const result = await this.client.queryMXE({
    operation: 'COMPUTE_PAYOUT',
    marketId: request.marketId,
    userPubkey: request.userPubkey,
  });
  
  return {
    payoutAmount: result.amount,
    proof: result.proof,
    mxeSignature: result.signature,
    timestamp: result.timestamp,
  };
}
```

#### 2.6 Implement verifyMXESignature()

```typescript
// BEFORE:
throw new Error('verifyMXESignature() requires official Arcium SDK');

// AFTER:
async verifyMXESignature(
  signature: Uint8Array,
  message: Uint8Array
): Promise<boolean> {
  const mxePublicKey = await this.client.getMXEPublicKey();
  
  return await this.client.verifySignature({
    signature,
    message,
    publicKey: mxePublicKey,
  });
}
```

#### 2.7 Update isArciumSDKConfigured()

```typescript
// BEFORE:
export function isArciumSDKConfigured(): boolean {
  return false; // ALWAYS FALSE
}

// AFTER:
export function isArciumSDKConfigured(): boolean {
  try {
    // Check SDK installation
    const sdk = require('@arcium/sdk');
    
    // Check environment variables
    const endpoint = process.env.VITE_ARCIUM_MXE_ENDPOINT;
    const apiKey = process.env.VITE_ARCIUM_API_KEY;
    
    return !!(sdk && endpoint && apiKey);
  } catch {
    return false;
  }
}
```

---

### Step 3: Update NexoraContext Integration

**File:** [app/src/contexts/NexoraContext.tsx](app/src/contexts/NexoraContext.tsx)

#### 3.1 Add Arcium Client Import

```typescript
import { createArciumClient, isArciumSDKConfigured } from '../lib/arcium-sdk-client';
```

#### 3.2 Initialize in Context Provider

```typescript
const [arciumClient] = useState(() => {
  if (!isArciumSDKConfigured()) {
    console.warn('⚠️ Arcium SDK not configured - bets will NOT be confidential');
    return null;
  }
  
  return createArciumClient({
    mxeEndpoint: import.meta.env.VITE_ARCIUM_MXE_ENDPOINT,
    networkId: 'devnet',
    authToken: import.meta.env.VITE_ARCIUM_API_KEY,
  });
});
```

#### 3.3 Update placeBet() Method

Replace current mock encryption:

```typescript
// BEFORE (current mock - lines ~100-130):
const encryptedSide = btoa(side); // ❌ NOT CONFIDENTIAL

// AFTER (real SDK encryption):
if (!arciumClient) {
  throw new Error('Arcium SDK not configured');
}

// 1. Encrypt bet using SDK
const encrypted = await arciumClient.encryptBet({
  market: marketPubkey.toBase58(),
  user: wallet.publicKey.toBase58(),
  side,
  amount,
});

// 2. Submit to MXE
const mxeResult = await arciumClient.submitBetToMXE(encrypted, {
  market: marketPubkey.toBase58(),
  user: wallet.publicKey.toBase58(),
});

console.log('✅ Bet submitted to MXE:', mxeResult.transactionId);

// 3. Store MXE transaction ID for later verification
// You may want to store this in a user account or local state
```

---

### Step 4: Update Anchor Program for Proof Verification

**File:** [programs/nexora/src/lib.rs](programs/nexora/src/lib.rs)

#### 4.1 Add MXE Public Key Constant

```rust
// Add after ADMIN_PUBKEY (line 10):
// 🚨 REPLACE WITH ACTUAL MXE PUBKEY FROM ARCIUM
pub const MXE_PUBKEY: Pubkey = pubkey!("REPLACE_WITH_ARCIUM_MXE_PUBKEY");
```

#### 4.2 Update Claim Instruction Accounts

```rust
// BEFORE (current simple claim):
#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    // ... rest
}

// AFTER (add proof verification):
#[derive(Accounts)]
pub struct ClaimWithProof<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    /// CHECK: MXE signer - verifies payout computation
    #[account(
        constraint = mxe_signer.key() == MXE_PUBKEY @ NexoraError::InvalidMXESignature
    )]
    pub mxe_signer: AccountInfo<'info>,
    
    // ... rest of accounts
}
```

#### 4.3 Add Proof Structure

```rust
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ArciumPayoutProof {
    /// MXE signature over (user, market, amount, timestamp)
    pub mxe_signature: [u8; 64],
    
    /// Timestamp of computation
    pub timestamp: i64,
    
    /// Computed payout amount
    pub payout_amount: u64,
}
```

#### 4.4 Implement Proof Verification

```rust
pub fn claim_with_proof(
    ctx: Context<ClaimWithProof>,
    proof: ArciumPayoutProof,
) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let user = &ctx.accounts.user;
    
    // 1. Market must be closed
    require!(market.is_closed, NexoraError::MarketStillActive);
    
    // 2. Verify MXE signature
    let message = construct_payout_message(
        user.key(),
        market.key(),
        proof.payout_amount,
        proof.timestamp,
    );
    
    let signature = Signature::new(&proof.mxe_signature);
    require!(
        signature.verify(ctx.accounts.mxe_signer.key(), &message),
        NexoraError::InvalidMXESignature
    );
    
    // 3. Verify timestamp is recent (prevent replay attacks)
    let clock = Clock::get()?;
    let max_age = 300; // 5 minutes
    require!(
        clock.unix_timestamp - proof.timestamp < max_age,
        NexoraError::ProofExpired
    );
    
    // 4. Transfer payout from vault
    let vault_bump = market.vault_bump;
    let market_key = market.key();
    let signer_seeds: &[&[&[u8]]] = &[&[
        b"vault",
        market_key.as_ref(),
        &[vault_bump],
    ]];
    
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            signer_seeds,
        ),
        proof.payout_amount,
    )?;
    
    msg!("✅ Claimed {} with verified MXE proof", proof.payout_amount);
    Ok(())
}

fn construct_payout_message(
    user: &Pubkey,
    market: &Pubkey,
    amount: u64,
    timestamp: i64,
) -> Vec<u8> {
    let mut message = Vec::new();
    message.extend_from_slice(user.as_ref());
    message.extend_from_slice(market.as_ref());
    message.extend_from_slice(&amount.to_le_bytes());
    message.extend_from_slice(&timestamp.to_le_bytes());
    message
}
```

#### 4.5 Add New Errors

```rust
#[error_code]
pub enum NexoraError {
    // ... existing errors
    
    #[msg("Invalid MXE signature - payout not verified")]
    InvalidMXESignature,
    
    #[msg("Proof expired - request new payout computation")]
    ProofExpired,
}
```

---

### Step 5: Update Frontend Claim Flow

**File:** [app/src/components/Dashboard.tsx](app/src/components/Dashboard.tsx) (or wherever claim UI is)

```typescript
// BEFORE (current simple claim):
await program.methods
  .claim()
  .accounts({ /* ... */ })
  .rpc();

// AFTER (claim with MXE proof):
const handleClaim = async (marketId: string) => {
  if (!arciumClient) {
    throw new Error('Arcium SDK not configured');
  }
  
  // 1. Request payout computation from MXE
  const payoutResult = await arciumClient.requestPayout({
    marketId,
    userPubkey: wallet.publicKey.toBase58(),
  });
  
  console.log('✅ Payout computed by MXE:', payoutResult.payoutAmount);
  
  // 2. Construct proof for Anchor program
  const proof = {
    mxeSignature: Array.from(payoutResult.mxeSignature),
    timestamp: payoutResult.timestamp,
    payoutAmount: new BN(payoutResult.payoutAmount),
  };
  
  // 3. Submit claim with proof
  const mxePubkey = new PublicKey(await arciumClient.getMXEPublicKey());
  
  await program.methods
    .claimWithProof(proof)
    .accounts({
      market: new PublicKey(marketId),
      user: wallet.publicKey,
      mxeSigner: mxePubkey,
      vault: vaultPDA,
      userTokenAccount: userTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
  
  console.log('✅ Claimed successfully');
};
```

---

### Step 6: Environment Configuration

**File:** [app/.env.local](app/.env.local) (create if doesn't exist)

```bash
# Arcium MXE Configuration
VITE_ARCIUM_MXE_ENDPOINT=https://mxe.arcium.com/devnet  # 🚨 REPLACE WITH ACTUAL
VITE_ARCIUM_API_KEY=your_api_key_here  # 🚨 REPLACE WITH ACTUAL
VITE_ARCIUM_NETWORK=devnet
```

**Security Note:** For production, use secure key management (environment variables, secrets manager). Never commit API keys to git.

---

### Step 7: Deploy MXE Enclave

You need to deploy the confidential computation logic to Arcium MXE. This is typically Rust code that runs inside a TEE (Trusted Execution Environment).

**File:** Create `mxe-enclave/src/lib.rs` (separate crate)

```rust
// This is the confidential computation that runs inside MXE
// See ARCIUM_INTEGRATION_SPEC.md Section 2 for full implementation

use std::collections::HashMap;

pub struct EnclaveStateManager {
    // Confidential storage - NOT visible on-chain
    user_bets: HashMap<(String, String), Vec<ConfidentialBet>>,
    market_states: HashMap<String, MarketState>,
}

struct ConfidentialBet {
    user: String,
    market: String,
    side: Side,
    amount: u64,
    timestamp: i64,
}

impl EnclaveStateManager {
    pub fn record_bet(&mut self, bet: ConfidentialBet) {
        let key = (bet.user.clone(), bet.market.clone());
        self.user_bets.entry(key).or_insert_with(Vec::new).push(bet);
    }
    
    pub fn compute_payout(
        &self,
        user: &str,
        market: &str,
    ) -> Result<u64, EnclaveError> {
        let market_state = self.market_states.get(market)
            .ok_or(EnclaveError::MarketNotFound)?;
        
        let key = (user.to_string(), market.to_string());
        let bets = self.user_bets.get(&key)
            .ok_or(EnclaveError::NoBetsFound)?;
        
        let winning_side = market_state.winning_side
            .ok_or(EnclaveError::MarketNotResolved)?;
        
        let payout: u64 = bets.iter()
            .filter(|bet| bet.side == winning_side)
            .map(|bet| calculate_payout(bet.amount, market_state))
            .sum();
        
        Ok(payout)
    }
}

// Deploy this to Arcium MXE using their CLI/SDK tools
```

**Deployment command (example):**
```bash
# 🚨 REPLACE WITH ACTUAL ARCIUM CLI COMMANDS
arcium deploy --enclave mxe-enclave/ --network devnet
```

---

### Step 8: Testing

#### 8.1 Unit Tests

```typescript
// app/src/lib/__tests__/arcium-sdk-client.test.ts

import { NexoraArciumClient } from '../arcium-sdk-client';

describe('Arcium SDK Integration', () => {
  let client: NexoraArciumClient;
  
  beforeEach(() => {
    client = new NexoraArciumClient({
      mxeEndpoint: 'https://mxe.arcium.com/devnet',
      networkId: 'devnet',
    });
  });
  
  it('should encrypt bet payload', async () => {
    const payload = {
      market: 'test_market_pubkey',
      user: 'test_user_pubkey',
      side: 'yes' as const,
      amount: 1000000,
    };
    
    const encrypted = await client.encryptBet(payload);
    
    expect(encrypted.ciphertext).toBeInstanceOf(Uint8Array);
    expect(encrypted.nonce).toBeInstanceOf(Uint8Array);
    expect(encrypted.ciphertext.length).toBeGreaterThan(0);
  });
  
  it('should submit to MXE and get transaction ID', async () => {
    // ... test implementation
  });
});
```

#### 8.2 Integration Tests

```bash
cd /workspaces/nexora

# Test full flow:
# 1. Create market (admin only)
# 2. Place confidential bet
# 3. Resolve market
# 4. Claim with MXE proof

anchor test
```

#### 8.3 Manual Testing Checklist

- [ ] SDK initialization succeeds
- [ ] Bet encryption produces different ciphertext for same plaintext (nonce variation)
- [ ] MXE submission returns transaction ID
- [ ] MXE health check returns true
- [ ] Payout query returns signed proof
- [ ] On-chain claim verification accepts valid proof
- [ ] On-chain claim verification rejects invalid signature
- [ ] On-chain claim verification rejects expired proof
- [ ] Admin-only market creation still works
- [ ] Non-admin cannot create markets

---

### Step 9: Deploy to Production

#### 9.1 Rebuild Anchor Program

```bash
cd /workspaces/nexora
anchor build
anchor deploy --provider.cluster mainnet
```

#### 9.2 Deploy Frontend

```bash
cd app
npm run build
# Deploy to your hosting (Vercel, Netlify, etc.)
```

#### 9.3 Production Checklist

- [ ] MXE endpoint is mainnet (not devnet)
- [ ] API keys are securely stored
- [ ] Admin pubkey is correct for production
- [ ] USDC mint is mainnet USDC (EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)
- [ ] Program is audited
- [ ] Frontend handles SDK errors gracefully
- [ ] Rate limiting configured for MXE API
- [ ] Monitoring/alerts set up for MXE failures

---

## Troubleshooting

### Issue: "Arcium SDK not found"

**Solution:**
```bash
npm install @arcium/sdk --save
# Verify installation:
npm list @arcium/sdk
```

### Issue: "MXE endpoint unreachable"

**Solution:**
1. Check network connectivity
2. Verify endpoint URL in `.env.local`
3. Test MXE health:
```typescript
const healthy = await arciumClient.healthCheck();
console.log('MXE healthy:', healthy);
```

### Issue: "Invalid MXE signature"

**Possible causes:**
1. Proof expired (> 5 minutes old)
2. MXE public key mismatch
3. Message construction incorrect
4. Network ID mismatch (devnet vs mainnet)

**Solution:**
```typescript
// Debug signature verification
const mxePubkey = await arciumClient.getMXEPublicKey();
console.log('Expected MXE pubkey:', mxePubkey);
console.log('Program MXE_PUBKEY:', MXE_PUBKEY);
// These must match!
```

### Issue: "Encrypted bets still visible on-chain"

**This is EXPECTED.** Encryption happens client-side and in MXE. The Solana program only stores:
- Market metadata (public)
- Vault balances (public)
- User token accounts (public)

Confidential data (bet sides, amounts per user) are stored in MXE only.

---

## Verification

After completing all steps, verify confidentiality:

1. **Place a bet**
2. **Check Solana Explorer** for the transaction
3. **Verify:** You should NOT see the bet side or individual amount in transaction data
4. **Only visible:** Market pubkey, user pubkey, vault transfers (total amounts only)

Example transaction should show:
```
✅ Token transfer: 1 USDC from user to vault
❌ Bet side: HIDDEN (encrypted in MXE)
❌ Individual bet amount: HIDDEN (encrypted in MXE)
```

---

## Support

If you encounter issues during migration:

1. Check [ARCIUM_INTEGRATION_SPEC.md](ARCIUM_INTEGRATION_SPEC.md) for architecture details
2. Review [app/src/lib/arcium-sdk-client.ts](app/src/lib/arcium-sdk-client.ts) for SDK usage patterns
3. Consult official Arcium documentation (when available)
4. Check Arcium Discord/support channels

---

## Timeline Estimate

- **Step 1-2 (SDK Installation):** 1 hour
- **Step 3-5 (Code Integration):** 4-6 hours
- **Step 6-7 (Config + MXE Deployment):** 2-4 hours
- **Step 8 (Testing):** 2-3 hours
- **Step 9 (Production Deployment):** 1-2 hours

**Total:** ~10-16 hours (depends on SDK documentation quality)

---

## Next Steps

1. **Obtain Arcium SDK access** (this is the blocker)
2. Follow steps 1-9 sequentially
3. Test thoroughly on devnet
4. Deploy to mainnet only after full verification

**Current blocker:** Official Arcium SDK documentation and access credentials.

Once you have SDK access, this migration guide provides the complete path from 15% → 100% integration.
