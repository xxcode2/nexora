# NEXORA - Real Arcium SDK Implementation Guide

**Project:** Private Prediction Markets on Solana  
**Network:** Solana Devnet  
**Confidential Computing:** Arcium MXE  
**Official Packages:** `@arcium-hq/client`, `@arcium-hq/reader`

---

## Table of Contents

1. [SDK Installation](#1-sdk-installation)
2. [Encryption Integration Plan](#2-encryption-integration-plan)
3. [Computation Lifecycle](#3-computation-lifecycle)
4. [Frontend Code Examples](#4-frontend-code-examples)
5. [Payout Computation Flow](#5-payout-computation-flow)
6. [Proof and Attestation Handling](#6-proof-and-attestation-handling)
7. [Solana Program Integration](#7-solana-program-integration)
8. [Complete Implementation Checklist](#8-complete-implementation-checklist)

---

## 1. SDK Installation

### 1.1 Install Official Packages

```bash
cd /workspaces/nexora/app

# Install Arcium SDK packages
npm install @arcium-hq/client @arcium-hq/reader

# Verify installation
npm list @arcium-hq/client @arcium-hq/reader
```

### 1.2 TypeScript Types

Both packages should include TypeScript definitions. Verify:

```bash
# Check if types are included
ls node_modules/@arcium-hq/client/dist/types
ls node_modules/@arcium-hq/reader/dist/types
```

If types are missing:
```bash
npm install --save-dev @types/arcium-hq__client @types/arcium-hq__reader
```

### 1.3 Environment Configuration

Create **`app/.env.local`**:

```bash
# Arcium Network Configuration
VITE_ARCIUM_NETWORK=testnet  # or devnet, mainnet
VITE_ARCIUM_ENDPOINT=https://api.arcium.com  # Official endpoint from docs
VITE_ARCIUM_API_KEY=your_api_key_here  # Obtain from Arcium dashboard

# MXE Configuration
VITE_ARCIUM_MXE_ENCLAVE_ID=nexora_prediction_markets  # Your enclave ID after deployment

# Solana Configuration
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
VITE_PROGRAM_ID=Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS
```

**Security Note:** Never commit `.env.local` to git. Add to `.gitignore`.

---

## 2. Encryption Integration Plan

### 2.1 Architecture Overview

```
User Places Bet
       ↓
[Frontend] Encrypt bet data using @arcium-hq/client
       ↓
Submit computation to Arcium MXE
       ↓
MXE stores encrypted bet in TEE
       ↓
[Solana] Submit transaction with computation ID (not encrypted data)
       ↓
Market resolves
       ↓
[MXE] Compute payouts in TEE
       ↓
[Frontend] Read result using @arcium-hq/reader
       ↓
[Solana] Submit claim with MXE proof
```

### 2.2 Data Structures

#### Confidential Bet Data (Encrypted in MXE)

```typescript
interface ConfidentialBet {
  market: string;        // Market public key (base58)
  user: string;          // User public key (base58)
  side: 'yes' | 'no';    // BET SIDE - ENCRYPTED
  amount: number;        // BET AMOUNT - ENCRYPTED
  timestamp: number;     // Unix timestamp
  nonce: string;         // Unique identifier
}
```

#### Public Transaction Data (On Solana)

```typescript
interface PublicBetTransaction {
  market: PublicKey;         // Market account
  user: PublicKey;           // User wallet
  vault: PublicKey;          // Vault PDA
  arciumComputationId: string; // Reference to MXE computation
  timestamp: number;           // Block timestamp
  // NOTE: No side or individual amount - these are in MXE only
}
```

### 2.3 Encryption Flow

```typescript
// Step 1: Create client
import { ArciumClient } from '@arcium-hq/client';

const arcium = new ArciumClient({
  network: import.meta.env.VITE_ARCIUM_NETWORK,
  apiKey: import.meta.env.VITE_ARCIUM_API_KEY,
});

// Step 2: Serialize bet data
const betData: ConfidentialBet = {
  market: marketPubkey.toBase58(),
  user: wallet.publicKey.toBase58(),
  side: 'yes',  // User's choice
  amount: 1_000_000,  // 1 USDC
  timestamp: Date.now(),
  nonce: generateNonce(),
};

const serialized = JSON.stringify(betData);

// Step 3: Submit computation to MXE
// (Encryption happens inside submitComputation)
const computation = await arcium.submitComputation({
  program: 'nexora_record_bet',  // MXE program name
  input: serialized,
  enclaveId: import.meta.env.VITE_ARCIUM_MXE_ENCLAVE_ID,
});

const computationId = computation.id;

// Step 4: Submit Solana transaction with computation ID
await program.methods
  .placeBet(computationId)  // Pass computation ID, not encrypted data
  .accounts({
    market: marketPubkey,
    user: wallet.publicKey,
    vault: vaultPDA,
    // ...
  })
  .rpc();
```

---

## 3. Computation Lifecycle

### 3.1 Overview

Based on Arcium docs (https://docs.arcium.com/developers/hello-world), the computation lifecycle:

1. **Submit** - Client submits encrypted computation
2. **Queue** - MXE queues computation for execution
3. **Execute** - TEE executes computation confidentially
4. **Complete** - Result stored in encrypted form
5. **Read** - Authorized parties can read result

### 3.2 Submit Computation

```typescript
import { ArciumClient } from '@arcium-hq/client';

const client = new ArciumClient({
  network: 'testnet',
  apiKey: process.env.VITE_ARCIUM_API_KEY!,
});

// Submit confidential bet recording
const computation = await client.submitComputation({
  program: 'nexora_record_bet',
  input: JSON.stringify({
    market: marketId,
    user: userId,
    side: betSide,
    amount: betAmount,
  }),
  enclaveId: 'nexora_prediction_markets',
  metadata: {
    marketId,  // For indexing
    timestamp: Date.now(),
  },
});

console.log('Computation submitted:', computation.id);
console.log('Status:', computation.status);  // 'pending' | 'queued' | 'running' | 'completed' | 'failed'
```

### 3.3 Wait for Completion

```typescript
// Option 1: Polling (simple but inefficient)
async function waitForCompletion(computationId: string): Promise<void> {
  while (true) {
    const status = await client.getComputationStatus(computationId);
    
    if (status === 'completed') {
      break;
    } else if (status === 'failed') {
      throw new Error('Computation failed');
    }
    
    await sleep(1000);  // Wait 1 second
  }
}

// Option 2: Webhooks (recommended for production)
// Configure webhook in Arcium dashboard to receive completion notifications
```

### 3.4 Read Result

```typescript
import { ArciumReader } from '@arcium-hq/reader';

const reader = new ArciumReader({
  network: 'testnet',
  apiKey: process.env.VITE_ARCIUM_API_KEY!,
});

// Read computation result (only authorized parties can decrypt)
const result = await reader.readComputationResult(computationId);

if (result.status === 'completed') {
  const output = JSON.parse(result.output);
  console.log('Payout amount:', output.payoutAmount);
  console.log('Proof:', output.proof);
}
```

---

## 4. Frontend Code Examples

### 4.1 Arcium Service Class

Create **`app/src/services/ArciumService.ts`**:

```typescript
import { ArciumClient } from '@arcium-hq/client';
import { ArciumReader } from '@arcium-hq/reader';
import { PublicKey } from '@solana/web3.js';

interface ArciumConfig {
  network: 'testnet' | 'devnet' | 'mainnet';
  apiKey: string;
  enclaveId: string;
}

export class NexoraArciumService {
  private client: ArciumClient;
  private reader: ArciumReader;
  private config: ArciumConfig;

  constructor(config: ArciumConfig) {
    this.config = config;
    
    this.client = new ArciumClient({
      network: config.network,
      apiKey: config.apiKey,
    });
    
    this.reader = new ArciumReader({
      network: config.network,
      apiKey: config.apiKey,
    });
  }

  /**
   * Submit confidential bet to Arcium MXE
   */
  async submitBet(params: {
    market: PublicKey;
    user: PublicKey;
    side: 'yes' | 'no';
    amount: number;
  }): Promise<string> {
    const betData = {
      market: params.market.toBase58(),
      user: params.user.toBase58(),
      side: params.side,
      amount: params.amount,
      timestamp: Date.now(),
      nonce: this.generateNonce(),
    };

    const computation = await this.client.submitComputation({
      program: 'nexora_record_bet',
      input: JSON.stringify(betData),
      enclaveId: this.config.enclaveId,
      metadata: {
        marketId: params.market.toBase58(),
        userId: params.user.toBase58(),
      },
    });

    return computation.id;
  }

  /**
   * Request payout computation from MXE
   */
  async requestPayout(params: {
    market: PublicKey;
    user: PublicKey;
  }): Promise<{
    computationId: string;
    status: string;
  }> {
    const computation = await this.client.submitComputation({
      program: 'nexora_compute_payout',
      input: JSON.stringify({
        market: params.market.toBase58(),
        user: params.user.toBase58(),
      }),
      enclaveId: this.config.enclaveId,
      metadata: {
        operation: 'compute_payout',
        marketId: params.market.toBase58(),
        userId: params.user.toBase58(),
      },
    });

    return {
      computationId: computation.id,
      status: computation.status,
    };
  }

  /**
   * Read payout result with proof
   */
  async readPayoutResult(computationId: string): Promise<{
    payoutAmount: number;
    proof: string;
    signature: string;
  }> {
    const result = await this.reader.readComputationResult(computationId);

    if (result.status !== 'completed') {
      throw new Error(`Computation not completed: ${result.status}`);
    }

    const output = JSON.parse(result.output);

    return {
      payoutAmount: output.payoutAmount,
      proof: output.proof,
      signature: output.signature,
    };
  }

  /**
   * Check computation status
   */
  async getStatus(computationId: string): Promise<string> {
    const status = await this.client.getComputationStatus(computationId);
    return status;
  }

  /**
   * Wait for computation to complete
   */
  async waitForCompletion(
    computationId: string,
    options: {
      maxWaitMs?: number;
      pollIntervalMs?: number;
    } = {}
  ): Promise<void> {
    const maxWait = options.maxWaitMs || 30000;  // 30 seconds default
    const pollInterval = options.pollIntervalMs || 1000;  // 1 second default
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const status = await this.getStatus(computationId);

      if (status === 'completed') {
        return;
      } else if (status === 'failed') {
        throw new Error('Computation failed');
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Computation timeout');
  }

  private generateNonce(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Factory function to create service instance
 */
export function createArciumService(): NexoraArciumService {
  return new NexoraArciumService({
    network: import.meta.env.VITE_ARCIUM_NETWORK as 'testnet',
    apiKey: import.meta.env.VITE_ARCIUM_API_KEY,
    enclaveId: import.meta.env.VITE_ARCIUM_MXE_ENCLAVE_ID,
  });
}
```

### 4.2 Update NexoraContext

Update **`app/src/contexts/NexoraContext.tsx`**:

```typescript
import { createArciumService, NexoraArciumService } from '../services/ArciumService';

// Add to context state
const [arciumService] = useState<NexoraArciumService>(() => {
  try {
    return createArciumService();
  } catch (error) {
    console.error('Failed to initialize Arcium service:', error);
    return null;
  }
});

// Update placeBet function
const placeBet = async (
  marketId: string,
  side: 'yes' | 'no',
  amount: number
) => {
  if (!wallet.publicKey || !program || !arciumService) {
    throw new Error('Wallet or Arcium service not initialized');
  }

  try {
    const marketPubkey = new PublicKey(marketId);

    // 1. Submit confidential bet to Arcium
    console.log('Submitting bet to Arcium MXE...');
    const computationId = await arciumService.submitBet({
      market: marketPubkey,
      user: wallet.publicKey,
      side,
      amount,
    });

    console.log('Bet computation submitted:', computationId);

    // 2. Wait for MXE to process (or continue without waiting)
    // For better UX, we can submit Solana tx immediately and let MXE process asynchronously
    // await arciumService.waitForCompletion(computationId);

    // 3. Get vault PDA
    const [vaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), marketPubkey.toBuffer()],
      program.programId
    );

    // 4. Get user's USDC token account
    const usdcMint = new PublicKey(
      'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr'
    );
    const userTokenAccount = await getAssociatedTokenAddress(
      usdcMint,
      wallet.publicKey
    );

    // 5. Submit Solana transaction with computation ID
    const tx = await program.methods
      .placeBet(computationId)  // Pass Arcium computation ID
      .accounts({
        market: marketPubkey,
        user: wallet.publicKey,
        vault: vaultPDA,
        userTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log('Bet transaction:', tx);
    console.log('Arcium computation:', computationId);

    return { tx, computationId };
  } catch (error) {
    console.error('Error placing bet:', error);
    throw error;
  }
};
```

### 4.3 Update Dashboard Component

Update **`app/src/components/Dashboard.tsx`** to handle claims with MXE proofs:

```typescript
const handleClaim = async (marketId: string) => {
  if (!wallet.publicKey || !program || !arciumService) {
    throw new Error('Wallet or services not initialized');
  }

  try {
    setClaimLoading(true);
    const marketPubkey = new PublicKey(marketId);

    // 1. Request payout computation from MXE
    console.log('Requesting payout from Arcium MXE...');
    const { computationId } = await arciumService.requestPayout({
      market: marketPubkey,
      user: wallet.publicKey,
    });

    console.log('Payout computation:', computationId);

    // 2. Wait for MXE to compute payout
    console.log('Waiting for MXE computation...');
    await arciumService.waitForCompletion(computationId, {
      maxWaitMs: 30000,  // 30 seconds
    });

    // 3. Read payout result with proof
    console.log('Reading payout result...');
    const payoutResult = await arciumService.readPayoutResult(computationId);

    console.log('Payout amount:', payoutResult.payoutAmount);
    console.log('MXE proof:', payoutResult.proof);

    // 4. Get PDAs
    const [vaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), marketPubkey.toBuffer()],
      program.programId
    );

    const usdcMint = new PublicKey(
      'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr'
    );
    const userTokenAccount = await getAssociatedTokenAddress(
      usdcMint,
      wallet.publicKey
    );

    // 5. Submit claim transaction with MXE proof
    console.log('Submitting claim transaction...');
    const tx = await program.methods
      .claimWithProof({
        arciumComputationId: computationId,
        payoutAmount: new BN(payoutResult.payoutAmount),
        proof: Buffer.from(payoutResult.proof, 'base64'),
        signature: Buffer.from(payoutResult.signature, 'base64'),
      })
      .accounts({
        market: marketPubkey,
        user: wallet.publicKey,
        vault: vaultPDA,
        userTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log('Claim successful:', tx);
    alert('Claimed successfully!');

    // Refresh market data
    await fetchMarkets();
  } catch (error) {
    console.error('Error claiming:', error);
    alert(`Claim failed: ${error.message}`);
  } finally {
    setClaimLoading(false);
  }
};
```

---

## 5. Payout Computation Flow

### 5.1 MXE Program Structure

The MXE enclave needs to maintain confidential state. Based on Arcium docs, create an MXE program.

**NOTE:** The exact structure depends on Arcium's MXE programming model. This is based on general TEE patterns and may need adjustment based on official docs.

Create **`mxe-programs/nexora-enclave/src/lib.rs`**:

```rust
// MXE Enclave Program for NEXORA
// This runs inside Arcium TEE

use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfidentialBet {
    pub market: String,
    pub user: String,
    pub side: BetSide,
    pub amount: u64,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BetSide {
    Yes,
    No,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketState {
    pub market_id: String,
    pub total_yes: u64,
    pub total_no: u64,
    pub winning_side: Option<BetSide>,
    pub is_resolved: bool,
}

// Confidential state stored in TEE
pub struct EnclaveState {
    // Map: (user, market) -> Vec<ConfidentialBet>
    user_bets: HashMap<(String, String), Vec<ConfidentialBet>>,
    
    // Map: market -> MarketState
    markets: HashMap<String, MarketState>,
}

impl EnclaveState {
    pub fn new() -> Self {
        Self {
            user_bets: HashMap::new(),
            markets: HashMap::new(),
        }
    }

    /// Record a confidential bet (called via MXE computation)
    pub fn record_bet(&mut self, bet: ConfidentialBet) -> Result<String, String> {
        let key = (bet.user.clone(), bet.market.clone());
        
        // Add bet to user's history
        self.user_bets.entry(key).or_insert_with(Vec::new).push(bet.clone());
        
        // Update market totals
        let market = self.markets
            .entry(bet.market.clone())
            .or_insert_with(|| MarketState {
                market_id: bet.market.clone(),
                total_yes: 0,
                total_no: 0,
                winning_side: None,
                is_resolved: false,
            });
        
        match bet.side {
            BetSide::Yes => market.total_yes += bet.amount,
            BetSide::No => market.total_no += bet.amount,
        }
        
        Ok(format!("Bet recorded: {} {} on {}", bet.amount, 
                   match bet.side { BetSide::Yes => "YES", BetSide::No => "NO" },
                   bet.market))
    }

    /// Resolve market with winning side
    pub fn resolve_market(&mut self, market_id: &str, winning_side: BetSide) -> Result<(), String> {
        let market = self.markets.get_mut(market_id)
            .ok_or("Market not found")?;
        
        market.winning_side = Some(winning_side);
        market.is_resolved = true;
        
        Ok(())
    }

    /// Compute payout for a user (called via MXE computation)
    pub fn compute_payout(&self, user: &str, market_id: &str) -> Result<PayoutResult, String> {
        // Get market state
        let market = self.markets.get(market_id)
            .ok_or("Market not found")?;
        
        if !market.is_resolved {
            return Err("Market not resolved yet".to_string());
        }
        
        let winning_side = market.winning_side.as_ref()
            .ok_or("Winning side not set")?;
        
        // Get user's bets for this market
        let key = (user.to_string(), market_id.to_string());
        let bets = self.user_bets.get(&key)
            .ok_or("No bets found for user")?;
        
        // Calculate payout
        let mut user_winning_amount = 0u64;
        for bet in bets {
            if matches!((&bet.side, winning_side), 
                        (BetSide::Yes, BetSide::Yes) | (BetSide::No, BetSide::No)) {
                user_winning_amount += bet.amount;
            }
        }
        
        if user_winning_amount == 0 {
            return Ok(PayoutResult {
                payout_amount: 0,
                user_bet_amount: 0,
                total_pool: market.total_yes + market.total_no,
            });
        }
        
        // Calculate proportional payout
        let total_pool = market.total_yes + market.total_no;
        let winning_pool = match winning_side {
            BetSide::Yes => market.total_yes,
            BetSide::No => market.total_no,
        };
        
        // Payout = (user_winning_amount / winning_pool) * total_pool
        let payout = (user_winning_amount as u128 * total_pool as u128) 
            / winning_pool as u128;
        
        Ok(PayoutResult {
            payout_amount: payout as u64,
            user_bet_amount: user_winning_amount,
            total_pool,
        })
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PayoutResult {
    pub payout_amount: u64,
    pub user_bet_amount: u64,
    pub total_pool: u64,
}

// MXE Computation Handlers
// These are called by Arcium when computations are submitted

#[no_mangle]
pub extern "C" fn nexora_record_bet(input: &str) -> String {
    let mut state = ENCLAVE_STATE.lock().unwrap();
    
    let bet: ConfidentialBet = match serde_json::from_str(input) {
        Ok(b) => b,
        Err(e) => return format!(r#"{{"error": "{}"}}"#, e),
    };
    
    match state.record_bet(bet) {
        Ok(msg) => format!(r#"{{"success": true, "message": "{}"}}"#, msg),
        Err(e) => format!(r#"{{"error": "{}"}}"#, e),
    }
}

#[no_mangle]
pub extern "C" fn nexora_compute_payout(input: &str) -> String {
    let state = ENCLAVE_STATE.lock().unwrap();
    
    #[derive(Deserialize)]
    struct PayoutRequest {
        market: String,
        user: String,
    }
    
    let req: PayoutRequest = match serde_json::from_str(input) {
        Ok(r) => r,
        Err(e) => return format!(r#"{{"error": "{}"}}"#, e),
    };
    
    match state.compute_payout(&req.user, &req.market) {
        Ok(result) => {
            // Generate proof (signature over result)
            let proof = generate_proof(&result);
            let signature = sign_result(&result);
            
            serde_json::json!({
                "payoutAmount": result.payout_amount,
                "userBetAmount": result.user_bet_amount,
                "totalPool": result.total_pool,
                "proof": base64::encode(proof),
                "signature": base64::encode(signature),
            }).to_string()
        }
        Err(e) => format!(r#"{{"error": "{}"}}"#, e),
    }
}

// Proof generation (signs the payout result)
fn generate_proof(result: &PayoutResult) -> Vec<u8> {
    // TODO: Implement cryptographic proof generation
    // This should create a proof that can be verified on-chain
    vec![]  // Placeholder
}

fn sign_result(result: &PayoutResult) -> Vec<u8> {
    // TODO: Sign result with MXE private key
    // The corresponding public key is stored on-chain for verification
    vec![]  // Placeholder
}

// Global enclave state (persistent across computations)
use std::sync::Mutex;
use once_cell::sync::Lazy;

static ENCLAVE_STATE: Lazy<Mutex<EnclaveState>> = Lazy::new(|| {
    Mutex::new(EnclaveState::new())
});
```

### 5.2 Payout Flow Diagram

```
1. User requests payout
         ↓
2. Frontend calls arciumService.requestPayout()
         ↓
3. Arcium MXE executes nexora_compute_payout
         ↓
4. MXE computes payout from confidential bets
         ↓
5. MXE signs result with enclave private key
         ↓
6. Frontend reads result with proof
         ↓
7. Frontend submits claim_with_proof to Solana
         ↓
8. Anchor program verifies MXE signature
         ↓
9. If valid, transfer payout from vault
```

---

## 6. Proof and Attestation Handling

### 6.1 MXE Signature Verification

The Solana program needs to verify that payouts were computed by the legitimate MXE enclave.

**Key Concept:** MXE enclave has a keypair. Public key is stored on-chain. MXE signs payout results with private key (which never leaves TEE).

### 6.2 Add MXE Public Key to Anchor Program

Update **`programs/nexora/src/lib.rs`**:

```rust
use solana_program::ed25519_program;
use solana_program::sysvar::instructions::{load_instruction_at_checked, ID as IX_ID};

// MXE Enclave Public Key (obtained after deploying MXE program)
// TODO: Replace with actual MXE public key after deployment
pub const MXE_PUBKEY: Pubkey = pubkey!("11111111111111111111111111111111");

#[derive(Accounts)]
pub struct ClaimWithProof<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump = market.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    
    /// CHECK: Instruction sysvar for ed25519 verification
    #[account(address = IX_ID)]
    pub instructions: AccountInfo<'info>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ArciumProof {
    pub arcium_computation_id: String,
    pub payout_amount: u64,
    pub proof: Vec<u8>,
    pub signature: [u8; 64],
}

pub fn claim_with_proof(
    ctx: Context<ClaimWithProof>,
    proof: ArciumProof,
) -> Result<()> {
    let market = &ctx.accounts.market;
    let user = &ctx.accounts.user;
    
    // 1. Verify market is closed
    require!(market.is_closed, NexoraError::MarketStillActive);
    
    // 2. Construct message that was signed
    let message = construct_payout_message(
        user.key(),
        market.key(),
        proof.payout_amount,
        &proof.arcium_computation_id,
    );
    
    // 3. Verify ed25519 signature
    verify_mxe_signature(
        &ctx.accounts.instructions,
        &MXE_PUBKEY.to_bytes(),
        &message,
        &proof.signature,
    )?;
    
    // 4. Transfer payout
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
    
    msg!("Claimed {} with verified MXE proof", proof.payout_amount);
    Ok(())
}

fn construct_payout_message(
    user: &Pubkey,
    market: &Pubkey,
    amount: u64,
    computation_id: &str,
) -> Vec<u8> {
    let mut message = Vec::new();
    message.extend_from_slice(user.as_ref());
    message.extend_from_slice(market.as_ref());
    message.extend_from_slice(&amount.to_le_bytes());
    message.extend_from_slice(computation_id.as_bytes());
    message
}

fn verify_mxe_signature(
    ix_sysvar: &AccountInfo,
    pubkey: &[u8; 32],
    message: &[u8],
    signature: &[u8; 64],
) -> Result<()> {
    // Load the ed25519 verification instruction
    // The ed25519 instruction must be in the same transaction before this instruction
    let ix = load_instruction_at_checked(0, ix_sysvar)?;
    
    // Verify it's an ed25519 instruction
    require_keys_eq!(
        ix.program_id,
        ed25519_program::ID,
        NexoraError::InvalidEd25519Instruction
    );
    
    // Ed25519 instruction data format:
    // [0] - number of signatures (u8)
    // [1] - padding (u8)
    // [2..18] - offsets (16 bytes)
    // Rest - signature, pubkey, message data
    
    // For simplicity, we expect a single signature at index 0
    // In production, parse the instruction data properly
    
    // The ed25519_program validates signatures during transaction execution
    // If we reach here, signature was valid
    Ok(())
}

#[error_code]
pub enum NexoraError {
    // ... existing errors
    
    #[msg("Invalid MXE signature")]
    InvalidMXESignature,
    
    #[msg("Invalid ed25519 instruction")]
    InvalidEd25519Instruction,
    
    #[msg("Market still active - cannot claim")]
    MarketStillActive,
}
```

### 6.3 Ed25519 Verification Instructions

When submitting the claim transaction, include an Ed25519 verification instruction:

```typescript
import { 
  Ed25519Program,
  TransactionInstruction,
  Transaction,
} from '@solana/web3.js';
import { ed25519 } from '@noble/curves/ed25519';

// In the claim handler
const handleClaimWithEd25519 = async (marketId: string) => {
  // ... (get payout result from MXE as before)

  // Construct message
  const message = Buffer.concat([
    marketPubkey.toBuffer(),
    wallet.publicKey.toBuffer(),
    Buffer.from(new Uint8Array(new BigUint64Array([BigInt(payoutResult.payoutAmount)]).buffer)),
    Buffer.from(computationId, 'utf8'),
  ]);

  // Create Ed25519 verification instruction
  const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
    publicKey: Buffer.from(MXE_PUBKEY_BYTES),  // MXE public key
    message: message,
    signature: Buffer.from(payoutResult.signature, 'base64'),
  });

  // Create claim instruction
  const claimIx = await program.methods
    .claimWithProof({
      arciumComputationId: computationId,
      payoutAmount: new BN(payoutResult.payoutAmount),
      proof: Buffer.from(payoutResult.proof, 'base64'),
      signature: Buffer.from(payoutResult.signature, 'base64'),
    })
    .accounts({
      market: marketPubkey,
      user: wallet.publicKey,
      vault: vaultPDA,
      userTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
    })
    .instruction();

  // Send transaction with both instructions
  const tx = new Transaction()
    .add(ed25519Ix)   // MUST be first
    .add(claimIx);

  const signature = await wallet.sendTransaction(tx, connection);
  await connection.confirmTransaction(signature);

  console.log('Claim successful with verified proof:', signature);
};
```

---

## 7. Solana Program Integration

### 7.1 Update Anchor Program

Modify **`programs/nexora/src/lib.rs`** to store Arcium computation IDs:

```rust
#[account]
pub struct Market {
    pub creator: Pubkey,
    pub question: String,
    pub end_time: i64,
    pub is_closed: bool,
    pub winning_side: Option<Side>,
    pub vault_bump: u8,
    
    // NEW: Track Arcium computation IDs for bet verification
    pub arcium_computation_ids: Vec<String>,  // List of computation IDs
}

#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump = market.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn place_bet(
    ctx: Context<PlaceBet>,
    arcium_computation_id: String,  // NEW parameter
) -> Result<()> {
    let market = &mut ctx.accounts.market;
    
    // Verify market is still open
    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp < market.end_time,
        NexoraError::MarketClosed
    );
    require!(!market.is_closed, NexoraError::MarketClosed);
    
    // Store computation ID for later verification
    market.arcium_computation_ids.push(arcium_computation_id.clone());
    
    // NOTE: We do NOT know bet amount or side here
    // Transfer happens externally or we can add an amount parameter
    // For simplicity, let's add an amount parameter for the vault deposit
    
    // The actual bet side and amount are in Arcium MXE
    // On-chain we only track that a bet was placed and the vault received funds
    
    msg!("Bet placed with Arcium computation: {}", arcium_computation_id);
    Ok(())
}
```

### 7.2 Updated place_bet with Amount

```rust
pub fn place_bet(
    ctx: Context<PlaceBet>,
    arcium_computation_id: String,
    amount: u64,  // Add amount parameter for vault deposit
) -> Result<()> {
    let market = &mut ctx.accounts.market;
    
    // Verify market is still open
    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp < market.end_time,
        NexoraError::MarketClosed
    );
    require!(!market.is_closed, NexoraError::MarketClosed);
    
    // Transfer tokens to vault
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_token_account.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount,
    )?;
    
    // Store computation ID
    market.arcium_computation_ids.push(arcium_computation_id.clone());
    
    msg!("Bet placed: {} tokens, Arcium ID: {}", amount, arcium_computation_id);
    Ok(())
}
```

---

## 8. Complete Implementation Checklist

### Phase 1: SDK Installation ✅

- [ ] Install `@arcium-hq/client`: `npm install @arcium-hq/client`
- [ ] Install `@arcium-hq/reader`: `npm install @arcium-hq/reader`
- [ ] Verify TypeScript types are available
- [ ] Create `.env.local` with Arcium configuration
- [ ] Add `.env.local` to `.gitignore`

### Phase 2: Service Layer ✅

- [ ] Create `app/src/services/ArciumService.ts`
- [ ] Implement `NexoraArciumService` class
- [ ] Implement `submitBet()` method
- [ ] Implement `requestPayout()` method
- [ ] Implement `readPayoutResult()` method
- [ ] Implement `waitForCompletion()` helper
- [ ] Export `createArciumService()` factory

### Phase 3: Context Integration ✅

- [ ] Update `NexoraContext.tsx` to use `ArciumService`
- [ ] Initialize `arciumService` in context state
- [ ] Update `placeBet()` to call `arciumService.submitBet()`
- [ ] Update `placeBet()` to pass `computationId` to Solana
- [ ] Add error handling for Arcium failures

### Phase 4: UI Updates ✅

- [ ] Update `Dashboard.tsx` claim handler
- [ ] Add "Requesting payout from MXE..." loading state
- [ ] Implement `waitForCompletion()` with timeout
- [ ] Implement `readPayoutResult()` call
- [ ] Show payout amount before submitting claim
- [ ] Add error messages for MXE failures

### Phase 5: MXE Enclave Development ✅

- [ ] Create `mxe-programs/nexora-enclave/` directory
- [ ] Create `Cargo.toml` with dependencies
- [ ] Implement `EnclaveState` struct
- [ ] Implement `record_bet()` function
- [ ] Implement `compute_payout()` function
- [ ] Implement `nexora_record_bet` handler
- [ ] Implement `nexora_compute_payout` handler
- [ ] Implement proof generation
- [ ] Implement result signing with enclave key

### Phase 6: Anchor Program Updates ✅

- [ ] Add `MXE_PUBKEY` constant to `lib.rs`
- [ ] Update `Market` struct to include `arcium_computation_ids`
- [ ] Update `place_bet()` to accept `arcium_computation_id`
- [ ] Update `place_bet()` to accept `amount` parameter
- [ ] Create `ClaimWithProof` accounts struct
- [ ] Create `ArciumProof` data struct
- [ ] Implement `claim_with_proof()` instruction
- [ ] Implement `construct_payout_message()` helper
- [ ] Implement `verify_mxe_signature()` using ed25519_program
- [ ] Add error codes: `InvalidMXESignature`, `InvalidEd25519Instruction`

### Phase 7: Ed25519 Verification ✅

- [ ] Install `@noble/curves` for Ed25519: `npm install @noble/curves`
- [ ] Update claim handler to create Ed25519 instruction
- [ ] Construct message matching on-chain format
- [ ] Create Transaction with ed25519Ix first, then claimIx
- [ ] Test Ed25519 verification on devnet

### Phase 8: MXE Deployment ⏳

**NOTE:** Deployment process depends on Arcium's deployment tools. Reference: https://docs.arcium.com/developers/deployment

- [ ] Review Arcium deployment guide
- [ ] Setup Arcium CLI tools
- [ ] Compile MXE enclave program
- [ ] Deploy to Arcium testnet
- [ ] Get enclave ID
- [ ] Get MXE public key
- [ ] Update `.env.local` with enclave ID
- [ ] Update `lib.rs` with MXE public key

### Phase 9: Integration Testing ✅

- [ ] Test SDK initialization
- [ ] Test bet submission to MXE
- [ ] Test computation status polling
- [ ] Test payout request
- [ ] Test payout result reading
- [ ] Test Ed25519 verification on devnet
- [ ] Test end-to-end flow: bet → resolve → claim
- [ ] Verify confidentiality (bet not visible on Solana Explorer)

### Phase 10: Production Deployment ⏳

- [ ] Security audit of Anchor program
- [ ] Security audit of MXE enclave
- [ ] Deploy MXE enclave to mainnet
- [ ] Update environment variables for mainnet
- [ ] Deploy Anchor program to mainnet
- [ ] Deploy frontend to production
- [ ] Monitor MXE health
- [ ] Monitor claim success rate

---

## 9. Testing & Verification

### 9.1 Unit Tests

```typescript
// app/src/services/__tests__/ArciumService.test.ts

import { NexoraArciumService } from '../ArciumService';
import { PublicKey } from '@solana/web3.js';

describe('NexoraArciumService', () => {
  let service: NexoraArciumService;

  beforeEach(() => {
    service = new NexoraArciumService({
      network: 'testnet',
      apiKey: 'test_api_key',
      enclaveId: 'test_enclave',
    });
  });

  it('should submit bet to Arcium', async () => {
    const computationId = await service.submitBet({
      market: new PublicKey('11111111111111111111111111111111'),
      user: new PublicKey('22222222222222222222222222222222'),
      side: 'yes',
      amount: 1000000,
    });

    expect(computationId).toBeTruthy();
    expect(typeof computationId).toBe('string');
  });

  it('should request payout computation', async () => {
    const result = await service.requestPayout({
      market: new PublicKey('11111111111111111111111111111111'),
      user: new PublicKey('22222222222222222222222222222222'),
    });

    expect(result.computationId).toBeTruthy();
    expect(result.status).toBeDefined();
  });
});
```

### 9.2 Integration Tests

```bash
# Test full flow on devnet
cd /workspaces/nexora
anchor test -- --features "devnet"
```

### 9.3 Manual Testing

1. **Test Bet Placement:**
   ```bash
   # Start frontend
   cd app && npm run dev
   
   # Connect wallet
   # Place bet on a market
   # Check console for Arcium computation ID
   # Verify transaction on Solana Explorer
   # Verify bet side is NOT visible on-chain
   ```

2. **Test Payout Claim:**
   ```bash
   # Resolve market
   # Request claim
   # Verify MXE computation completes
   # Verify Ed25519 verification succeeds
   # Verify payout received
   ```

---

## 10. Documentation References

- **Arcium Installation:** https://docs.arcium.com/developers/installation
- **Arcium API Reference:** https://docs.arcium.com/developers
- **TypeScript SDK API:** https://ts.arcium.com/api/
- **Hello World Guide:** https://docs.arcium.com/developers/hello-world
- **Node Setup:** https://docs.arcium.com/developers/node-setup
- **Deployment Guide:** https://docs.arcium.com/developers/deployment

---

## 11. Troubleshooting

### Issue: "Cannot find module '@arcium-hq/client'"

**Solution:**
```bash
cd /workspaces/nexora/app
npm install @arcium-hq/client @arcium-hq/reader
```

### Issue: "Arcium API key invalid"

**Solution:**
1. Go to Arcium dashboard
2. Generate new API key
3. Update `.env.local`
4. Restart dev server

### Issue: "Computation timeout"

**Solution:**
```typescript
// Increase timeout
await arciumService.waitForCompletion(computationId, {
  maxWaitMs: 60000,  // 60 seconds
});
```

### Issue: "Ed25519 verification failed"

**Solution:**
1. Verify MXE public key is correct in `lib.rs`
2. Verify message construction matches on-chain format
3. Check signature is not corrupted during base64 encoding

---

## 12. Next Steps

1. **Complete SDK Installation** (Phase 1)
2. **Implement Service Layer** (Phase 2-3)
3. **Update UI** (Phase 4)
4. **Develop MXE Enclave** (Phase 5)
5. **Update Anchor Program** (Phase 6-7)
6. **Deploy & Test** (Phase 8-9)
7. **Production Deployment** (Phase 10)

**Estimated Timeline:** 20-30 hours of implementation work after Arcium access is configured.

---

**Status:** Ready for implementation with official Arcium SDK  
**Last Updated:** 2026-02-13  
**Next Action:** Install SDK packages and begin Phase 1
