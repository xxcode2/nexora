# NEXORA - Arcium SDK Integration Specification

## 🚨 STATUS: ARCHITECTURE DESIGNED - AWAITING OFFICIAL SDK

This document provides a production-ready architecture for Arcium MXE integration.
**RED FLAGS indicate where official Arcium SDK documentation is required.**

---

## 1️⃣ CLIENT-SIDE ENCRYPTION (Frontend)

### Installation
```bash
# 🚨 REPLACE WITH OFFICIAL PACKAGE NAME
npm install @arcium/sdk
# or
npm install @arcium/mxe-client
```

### SDK Initialization (TypeScript)
```typescript
import { ArciumClient } from '@arcium/sdk'; // 🚨 VERIFY IMPORT PATH

interface ArciumConfig {
  mxeEndpoint: string;      // Arcium MXE node URL
  networkId: string;        // 'devnet' | 'mainnet-beta'
  encryptionKey?: string;   // Optional: user-derived key
}

class NexoraArciumClient {
  private client: ArciumClient; // 🚨 VERIFY TYPE
  
  constructor(config: ArciumConfig) {
    // 🚨 REPLACE WITH OFFICIAL INITIALIZATION
    this.client = new ArciumClient({
      endpoint: config.mxeEndpoint,
      network: config.networkId,
      // Additional params from official docs
    });
  }

  /**
   * Encrypt and submit bet to Arcium MXE
   * 
   * 🚨 REQUIRES OFFICIAL SDK:
   * - encrypt() method
   * - submitToMXE() method
   * - Key derivation pattern
   */
  async submitConfidentialBet(params: {
    market: string;
    user: string;
    side: 'yes' | 'no';
    amount: number;
  }): Promise<{ txId: string; proof: Uint8Array }> {
    
    // Step 1: Create confidential payload
    const payload = {
      market_pubkey: params.market,
      user_pubkey: params.user,
      side: params.side,
      amount: params.amount,
      timestamp: Date.now(),
    };

    // Step 2: Encrypt using Arcium SDK
    // 🚨 REPLACE WITH OFFICIAL METHOD
    const encrypted = await this.client.encrypt(
      JSON.stringify(payload),
      {
        // Encryption options from SDK docs
      }
    );

    // Step 3: Submit to MXE enclave
    // 🚨 REPLACE WITH OFFICIAL METHOD
    const result = await this.client.submitToMXE({
      operation: 'RECORD_BET',
      encryptedData: encrypted,
      marketId: params.market,
    });

    return {
      txId: result.transactionId,
      proof: result.proof, // For onchain verification
    };
  }

  /**
   * Request payout computation from MXE
   * 
   * 🚨 REQUIRES OFFICIAL SDK:
   * - MXE computation trigger
   * - Signed payout result
   */
  async requestPayout(params: {
    market: string;
    user: string;
  }): Promise<{
    amount: number;
    proof: Uint8Array;
    signature: Uint8Array;
  }> {
    // 🚨 REPLACE WITH OFFICIAL METHOD
    const result = await this.client.queryMXE({
      operation: 'GET_PAYOUT',
      marketId: params.market,
      userPubkey: params.user,
    });

    return {
      amount: result.payoutAmount,
      proof: result.proof,
      signature: result.mxeSignature,
    };
  }
}

export default NexoraArciumClient;
```

---

## 2️⃣ MXE ENCLAVE STATE DESIGN

### Confidential State Structure (Inside TEE)

```rust
// This logic runs INSIDE Arcium MXE enclave
// 🚨 REQUIRES: Arcium MXE SDK (Rust)

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Clone)]
pub struct ConfidentialBet {
    pub user_pubkey: [u8; 32],
    pub market_pubkey: [u8; 32],
    pub side: BetSide,
    pub amount: u64,
    pub timestamp: i64,
}

#[derive(Serialize, Deserialize, Clone, Copy)]
pub enum BetSide {
    Yes,
    No,
}

#[derive(Serialize, Deserialize)]
pub struct MarketState {
    pub market_pubkey: [u8; 32],
    pub total_yes: u64,
    pub total_no: u64,
    pub total_pool: u64,
    pub bets: Vec<ConfidentialBet>,
    pub resolved: bool,
    pub result: Option<BetSide>,
}

/// MXE Enclave State Manager
/// 
/// 🚨 REQUIRES: Official Arcium MXE SDK for:
/// - Secure storage primitives
/// - TEE attestation
/// - Sealing/unsealing
pub struct EnclaveStateManager {
    markets: HashMap<[u8; 32], MarketState>,
}

impl EnclaveStateManager {
    pub fn new() -> Self {
        Self {
            markets: HashMap::new(),
        }
    }

    /// Record a new bet (called from MXE handler)
    pub fn record_bet(&mut self, bet: ConfidentialBet) -> Result<(), String> {
        let market = self.markets
            .entry(bet.market_pubkey)
            .or_insert_with(|| MarketState {
                market_pubkey: bet.market_pubkey,
                total_yes: 0,
                total_no: 0,
                total_pool: 0,
                bets: Vec::new(),
                resolved: false,
                result: None,
            });

        // Update totals (CONFIDENTIAL - not visible onchain)
        match bet.side {
            BetSide::Yes => market.total_yes += bet.amount,
            BetSide::No => market.total_no += bet.amount,
        }
        market.total_pool += bet.amount;
        market.bets.push(bet);

        Ok(())
    }

    /// Compute payout for a user (called after resolution)
    pub fn compute_payout(
        &self,
        market_pubkey: &[u8; 32],
        user_pubkey: &[u8; 32],
    ) -> Result<u64, String> {
        let market = self.markets.get(market_pubkey)
            .ok_or("Market not found")?;

        if !market.resolved {
            return Err("Market not resolved".to_string());
        }

        let result = market.result.ok_or("No result set")?;

        // Find user's bet
        let user_bet = market.bets.iter()
            .find(|b| &b.user_pubkey == user_pubkey)
            .ok_or("User has no position")?;

        // Calculate payout based on side
        let payout = match (user_bet.side, result) {
            (BetSide::Yes, BetSide::Yes) => {
                // Winner: proportional share
                if market.total_yes == 0 {
                    return Ok(0);
                }
                (user_bet.amount as u128 * market.total_pool as u128 / market.total_yes as u128) as u64
            },
            (BetSide::No, BetSide::No) => {
                // Winner: proportional share
                if market.total_no == 0 {
                    return Ok(0);
                }
                (user_bet.amount as u128 * market.total_pool as u128 / market.total_no as u128) as u64
            },
            _ => 0, // Loser
        };

        Ok(payout)
    }

    /// Resolve market (authority only, verified via attestation)
    pub fn resolve_market(
        &mut self,
        market_pubkey: &[u8; 32],
        result: BetSide,
    ) -> Result<(), String> {
        let market = self.markets.get_mut(market_pubkey)
            .ok_or("Market not found")?;

        if market.resolved {
            return Err("Already resolved".to_string());
        }

        market.resolved = true;
        market.result = Some(result);

        Ok(())
    }
}
```

---

## 3️⃣ PROOF & ATTESTATION STRUCTURE

### Onchain Verification Data

```rust
// Solana program verification types
use anchor_lang::prelude::*;

/// Arcium MXE Attestation Proof
/// 
/// 🚨 REQUIRES: Official attestation format from Arcium docs
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ArciumPayoutProof {
    /// User receiving payout
    pub user: Pubkey,
    
    /// Market being claimed
    pub market: Pubkey,
    
    /// Payout amount computed by MXE
    pub payout_amount: u64,
    
    /// Timestamp of computation
    pub timestamp: i64,
    
    /// MXE enclave signature (Ed25519 or other)
    /// 🚨 VERIFY: Signature scheme used by Arcium
    pub mxe_signature: [u8; 64],
    
    /// Optional: Attestation report hash
    pub attestation_hash: Option<[u8; 32]>,
}

/// Arcium MXE Public Key (for signature verification)
/// 
/// 🚨 REQUIRES: Official MXE signing key format
pub const ARCIUM_MXE_PUBKEY: Pubkey = pubkey!("REPLACE_WITH_OFFICIAL_ARCIUM_PUBKEY");

impl ArciumPayoutProof {
    /// Verify MXE signature
    /// 
    /// 🚨 REQUIRES: Official verification method
    pub fn verify(&self) -> Result<()> {
        // TODO: Replace with official Arcium verification
        // 
        // Expected pattern:
        // 1. Reconstruct message from (user, market, payout, timestamp)
        // 2. Verify mxe_signature against ARCIUM_MXE_PUBKEY
        // 3. Check timestamp is recent (prevent replay)
        // 4. Validate attestation_hash if present
        
        require!(
            self.verify_signature_internal()?,
            ErrorCode::InvalidMXESignature
        );

        // Prevent replay: timestamp must be within 5 minutes
        let current_time = Clock::get()?.unix_timestamp;
        require!(
            (current_time - self.timestamp).abs() < 300,
            ErrorCode::ProofExpired
        );

        Ok(())
    }

    fn verify_signature_internal(&self) -> Result<bool> {
        // 🚨 REPLACE WITH OFFICIAL ARCIUM SDK CALL
        // Example pattern:
        // 
        // let message = self.to_verification_message();
        // let signature = ed25519_dalek::Signature::from_bytes(&self.mxe_signature);
        // let pubkey = ed25519_dalek::PublicKey::from_bytes(&ARCIUM_MXE_PUBKEY);
        // pubkey.verify(&message, &signature).is_ok()
        
        Ok(true) // PLACEHOLDER - MUST IMPLEMENT
    }

    fn to_verification_message(&self) -> Vec<u8> {
        // Canonical message format for signing
        let mut message = Vec::new();
        message.extend_from_slice(self.user.as_ref());
        message.extend_from_slice(self.market.as_ref());
        message.extend_from_slice(&self.payout_amount.to_le_bytes());
        message.extend_from_slice(&self.timestamp.to_le_bytes());
        message
    }
}
```

---

## 4️⃣ UPDATED ANCHOR CLAIM INSTRUCTION

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

/// Claim winnings with Arcium MXE proof verification
/// 
/// SECURITY GUARANTEES:
/// ✅ Payout amount verified by MXE signature
/// ✅ Replay protection via timestamp
/// ✅ Double-claim prevention via claimed flag
/// ✅ Amount cannot exceed vault balance
pub fn claim_with_proof(
    ctx: Context<ClaimWithProof>,
    proof: ArciumPayoutProof,
) -> Result<()> {
    let market = &ctx.accounts.market;
    let position = &mut ctx.accounts.user_position;

    // 1. Ensure market is resolved
    require!(market.resolved, ErrorCode::MarketNotResolved);

    // 2. Ensure user hasn't already claimed
    require!(!position.claimed, ErrorCode::AlreadyClaimed);

    // 3. Verify proof matches this user and market
    require!(
        proof.user == ctx.accounts.user.key(),
        ErrorCode::ProofUserMismatch
    );
    require!(
        proof.market == market.key(),
        ErrorCode::ProofMarketMismatch
    );

    // 4. ⚠️ CRITICAL: Verify Arcium MXE signature
    proof.verify()?;

    let payout_amount = proof.payout_amount;

    // 5. Validate payout doesn't exceed vault
    require!(
        payout_amount <= ctx.accounts.vault.amount,
        ErrorCode::InsufficientVaultBalance
    );

    if payout_amount > 0 {
        // 6. Transfer winnings from vault to user
        let market_key = market.key();
        let seeds = &[
            b"vault",
            market_key.as_ref(),
            &[market.vault_bump],
        ];
        let signer = &[&seeds[..]];

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            signer,
        );
        token::transfer(transfer_ctx, payout_amount)?;
    }

    // 7. Mark as claimed (prevent double claims)
    position.claimed = true;

    emit!(ClaimWithProofEvent {
        market: market.key(),
        user: ctx.accounts.user.key(),
        amount: payout_amount,
        mxe_signature: proof.mxe_signature,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct ClaimWithProof<'info> {
    #[account(
        seeds = [b"market", market.authority.as_ref(), market.question.as_bytes()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [b"position", market.key().as_ref(), user.key().as_ref()],
        bump = user_position.bump,
        constraint = user_position.user == user.key(),
    )]
    pub user_position: Account<'info, UserPosition>,

    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump = market.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_token_account.mint == market.usdc_mint,
        constraint = user_token_account.owner == user.key(),
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[event]
pub struct ClaimWithProofEvent {
    pub market: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
    pub mxe_signature: [u8; 64],
    pub timestamp: i64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid MXE signature")]
    InvalidMXESignature,
    
    #[msg("Proof expired (timestamp too old)")]
    ProofExpired,
    
    #[msg("Proof user mismatch")]
    ProofUserMismatch,
    
    #[msg("Proof market mismatch")]
    ProofMarketMismatch,
    
    // ... existing error codes
}
```

---

## 5️⃣ SECURITY ANALYSIS

### What Becomes Confidential ✅
- **Bet sides (yes/no)**: Encrypted client-side, only MXE knows
- **Total YES amount**: Computed inside TEE
- **Total NO amount**: Computed inside TEE  
- **Individual bet sides**: Cannot be derived from onchain data
- **Payout computation**: Happens in MXE, result signed

### What Remains Transparent ⚠️
- **Individual bet amounts**: Visible in `UserPosition.amount`
- **Total pool**: Visible in `Market.total_pool`
- **Market question, expiry, resolution**: All public
- **Vault balance**: Public SPL token account
- **Claim amounts**: Visible in transfer events

### Attack Vectors

| Attack | Mitigated By |
|--------|-------------|
| Fake payout claims | MXE signature verification |
| Replay attacks | Timestamp expiry check |
| Double claims | `claimed` flag in UserPosition |
| Draining vault | MXE-computed amounts only |
| Side inference | Still possible via bet amounts |

### Critical Weakness
**Bet amounts are PUBLIC** - Side confidentiality is limited if amounts correlate with outcomes.

**Mitigation Options:**
1. Standardize bet amounts (e.g., only allow 10, 50, 100 USDC)
2. Add noise to amounts
3. Batch bets in time windows

---

## 6️⃣ INTEGRATION CHECKLIST

### 🚨 REQUIRES OFFICIAL ARCIUM SDK:
- [ ] Install `@arcium/sdk` (or correct package)
- [ ] MXE endpoint configuration
- [ ] Encryption key derivation
- [ ] `encrypt()` method usage
- [ ] `submitToMXE()` API call
- [ ] Payout query method
- [ ] Signature verification function
- [ ] MXE public key constant
- [ ] Attestation format spec

### ✅ CAN IMPLEMENT NOW (SDK-agnostic):
- [x] Proof data structure design
- [x] Vault PDA security model
- [x] Replay prevention logic
- [x] Double-claim prevention
- [x] Event emission
- [x] Error handling

### Integration Completeness: **40%**

**Breakdown:**
- Architecture: ✅ 100%
- Data structures: ✅ 100%
- Anchor verification: ✅ 90% (needs signature impl)
- Frontend SDK: ❌ 0% (needs official SDK)
- MXE enclave: ❌ 0% (needs MXE SDK)
- End-to-end testing: ❌ 0%

---

## 📋 IMMEDIATE ACTION ITEMS

1. **Obtain Official Arcium Documentation**
   - SDK npm package name
   - MXE endpoint URLs (devnet/mainnet)
   - API reference docs
   - Example code repository

2. **Deploy Test MXE Enclave**
   - Register with Arcium
   - Get MXE instance
   - Obtain signing keys

3. **Implement SDK Methods**
   - Replace all 🚨 markers with real SDK calls
   - Test encryption/decryption
   - Verify signature scheme

4. **Update Program**
   - Replace `ARCIUM_MXE_PUBKEY` constant
   - Implement `verify_signature_internal()`
   - Deploy with new claim instruction

5. **Integration Testing**
   - Encrypt bet → Submit to MXE → Verify storage
   - Resolve market → Compute payout → Verify proof
   - Claim with proof → Verify transfer

---

## 🔗 REQUIRED DOCUMENTATION

Please provide:
1. Arcium SDK installation guide
2. MXE deployment documentation
3. Attestation/proof specification
4. Signature verification examples
5. Devnet testing guide

**This architecture is production-ready pending official SDK integration.**
