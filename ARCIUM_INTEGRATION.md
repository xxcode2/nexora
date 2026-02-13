# Arcium MXE Integration for NEXORA

## Overview

This document describes the Arcium MXE (Multi-party eXecution Environment) integration for confidential bet processing in NEXORA prediction markets.

## Architecture

```
User Client → Encrypt Payload → Solana Program → Arcium MXE → Store Encrypted Bets
                                                              ↓
                                      Market Resolved → Compute Payouts → Return to Solana
```

## 1. Encrypted Bet Payload Structure

### Client-Side (Before Encryption)

```typescript
interface BetPayload {
  user: string;           // User's public key
  market: string;         // Market public key
  side: "yes" | "no";     // Bet side (PRIVATE)
  amount: number;         // Bet amount in USDC (PRIVATE - redundant for MXE tracking)
  timestamp: number;      // Unix timestamp
}
```

### Encryption Flow

```typescript
// 1. Client creates payload
const payload: BetPayload = {
  user: userPubkey.toString(),
  market: marketPubkey.toString(),
  side: "yes",
  amount: 1000000, // 1 USDC (6 decimals)
  timestamp: Date.now(),
};

// 2. Serialize to JSON
const jsonPayload = JSON.stringify(payload);

// 3. Encrypt using Arcium SDK
const encryptedPayload = await arcium.encrypt(
  jsonPayload,
  mxeProgramId
);

// 4. Submit to Solana program
await program.methods
  .placeBet(encryptedPayload, new BN(1000000))
  .accounts({...})
  .rpc();
```

## 2. MXE State Structure

The MXE program maintains confidential state that is NEVER exposed publicly:

```rust
// Pseudo-code for MXE state
pub struct MXEMarketState {
    pub market: Pubkey,
    
    // Hidden mappings (never exposed)
    pub user_bets: HashMap<Pubkey, UserBet>,
    
    // Hidden totals
    pub total_yes_amount: u64,
    pub total_no_amount: u64,
}

pub struct UserBet {
    pub side: BetSide,        // PRIVATE
    pub amount: u64,          // PRIVATE
    pub payout: Option<u64>,  // Computed after resolution
}

pub enum BetSide {
    Yes,
    No,
}
```

### State Operations

#### On Bet Placement

```rust
// Called when BetPlacedEvent is emitted
fn on_bet_placed(event: BetPlacedEvent) -> Result<()> {
    // Decrypt the payload
    let payload: BetPayload = decrypt(event.encrypted_payload)?;
    
    // Get or create MXE state for this market
    let state = get_or_create_state(event.market);
    
    // Update user's bet (or accumulate if multiple bets)
    if let Some(existing_bet) = state.user_bets.get_mut(&payload.user) {
        // User already has a bet - accumulate on same side
        require!(existing_bet.side == payload.side, "Cannot change sides");
        existing_bet.amount += event.amount;
    } else {
        // New bet
        state.user_bets.insert(
            payload.user,
            UserBet {
                side: payload.side,
                amount: event.amount,
                payout: None,
            }
        );
    }
    
    // Update hidden totals
    match payload.side {
        BetSide::Yes => state.total_yes_amount += event.amount,
        BetSide::No => state.total_no_amount += event.amount,
    }
    
    Ok(())
}
```

## 3. Resolution & Payout Calculation

When the market is resolved, MXE computes payouts in a confidential manner.

### Computation Logic

```rust
fn compute_payouts(market: Pubkey, result: MarketResult, total_pool: u64) -> Result<()> {
    let state = get_state(market)?;
    
    // Determine winning side totals
    let (winning_total, winning_side) = match result {
        MarketResult::Yes => (state.total_yes_amount, BetSide::Yes),
        MarketResult::No => (state.total_no_amount, BetSide::No),
    };
    
    require!(winning_total > 0, "No winning bets");
    
    // Compute payout for each user
    for (user, bet) in state.user_bets.iter_mut() {
        if bet.side == winning_side {
            // Winner: proportional share of total pool
            // payout = (user_amount / winning_total) * total_pool
            let payout = (bet.amount as u128)
                .checked_mul(total_pool as u128)
                .unwrap()
                .checked_div(winning_total as u128)
                .unwrap() as u64;
            
            bet.payout = Some(payout);
        } else {
            // Loser: no payout
            bet.payout = Some(0);
        }
    }
    
    Ok(())
}
```

### Privacy Guarantees

The MXE computation ensures:
- ✅ Total pool is public (tracked on-chain)
- ✅ Individual payout is returned only to requesting user
- ❌ `total_yes_amount` never exposed
- ❌ `total_no_amount` never exposed
- ❌ Individual bet sides never exposed
- ❌ Individual bet amounts never exposed

## 4. Claim Flow

### User Requests Payout

```rust
// MXE query function
pub fn get_user_payout(market: Pubkey, user: Pubkey) -> Result<u64> {
    let state = get_state(market)?;
    
    // Return only this user's payout
    let bet = state.user_bets.get(&user)
        .ok_or(Error::NoBetFound)?;
    
    let payout = bet.payout
        .ok_or(Error::PayoutNotComputed)?;
    
    Ok(payout)
}
```

### Solana Program Integration

```rust
// In claim instruction
pub fn claim(ctx: Context<Claim>) -> Result<()> {
    // Query Arcium for this user's payout
    let payout_amount = arcium::get_user_payout(
        ctx.accounts.market.key(),
        ctx.accounts.user.key()
    )?;
    
    // Verify and transfer
    if payout_amount > 0 {
        token::transfer(/* ... */, payout_amount)?;
    }
    
    ctx.accounts.user_position.claimed = true;
    
    Ok(())
}
```

## 5. SDK Integration Points

### Client-Side TypeScript

```typescript
import { ArciumClient } from '@arcium/sdk';
import { Program, AnchorProvider } from '@coral-xyz/anchor';

class NexoraClient {
  constructor(
    private program: Program,
    private arciumClient: ArciumClient
  ) {}

  async placeBet(
    market: PublicKey,
    side: 'yes' | 'no',
    amount: BN
  ): Promise<string> {
    // 1. Create payload
    const payload = {
      user: this.program.provider.publicKey.toString(),
      market: market.toString(),
      side,
      amount: amount.toNumber(),
      timestamp: Date.now(),
    };

    // 2. Encrypt
    const encrypted = await this.arciumClient.encrypt(
      JSON.stringify(payload)
    );

    // 3. Submit to Solana
    const tx = await this.program.methods
      .placeBet(Array.from(encrypted), amount)
      .accounts({
        market,
        user: this.program.provider.publicKey,
        // ... other accounts
      })
      .rpc();

    return tx;
  }

  async claimPayout(market: PublicKey): Promise<string> {
    // 1. Query Arcium for payout amount
    const payoutAmount = await this.arciumClient.query(
      'get_user_payout',
      {
        market: market.toString(),
        user: this.program.provider.publicKey.toString(),
      }
    );

    // 2. Submit claim transaction
    const tx = await this.program.methods
      .claim(new BN(payoutAmount))
      .accounts({
        market,
        user: this.program.provider.publicKey,
        // ... other accounts
      })
      .rpc();

    return tx;
  }
}
```

## 6. Mock Interface for Devnet Testing

Since Arcium MXE requires setup, use a mock service for initial devnet testing:

```typescript
// arcium-mock.ts
export class ArciumMockClient {
  private bets: Map<string, any> = new Map();
  private marketStates: Map<string, any> = new Map();

  async encrypt(payload: string): Promise<Uint8Array> {
    // Simple mock: just return base64 encoded
    return new TextEncoder().encode(btoa(payload));
  }

  async decrypt(encrypted: Uint8Array): Promise<any> {
    const decoded = atob(new TextDecoder().decode(encrypted));
    return JSON.parse(decoded);
  }

  async recordBet(
    market: string,
    user: string,
    side: 'yes' | 'no',
    amount: number
  ) {
    const key = `${market}:${user}`;
    const existing = this.bets.get(key);

    if (existing) {
      existing.amount += amount;
    } else {
      this.bets.set(key, { side, amount, payout: null });
    }

    // Update totals
    const state = this.marketStates.get(market) || {
      totalYes: 0,
      totalNo: 0,
    };
    if (side === 'yes') state.totalYes += amount;
    else state.totalNo += amount;
    this.marketStates.set(market, state);
  }

  async computePayouts(
    market: string,
    result: 'yes' | 'no',
    totalPool: number
  ) {
    const state = this.marketStates.get(market);
    if (!state) throw new Error('Market not found');

    const winningTotal = result === 'yes' ? state.totalYes : state.totalNo;

    for (const [key, bet] of this.bets.entries()) {
      if (key.startsWith(market)) {
        if (bet.side === result) {
          bet.payout = Math.floor((bet.amount / winningTotal) * totalPool);
        } else {
          bet.payout = 0;
        }
      }
    }
  }

  async getUserPayout(market: string, user: string): Promise<number> {
    const key = `${market}:${user}`;
    const bet = this.bets.get(key);
    return bet?.payout ?? 0;
  }
}
```

## 7. Production Deployment

### Arcium Setup

1. Register MXE program on Arcium network
2. Deploy confidential computation logic
3. Configure event listeners for `BetPlacedEvent`
4. Set up secure query endpoints

### Security Considerations

- Use Arcium's TEE (Trusted Execution Environment) for computation
- Implement rate limiting on MXE queries
- Add signature verification for payout requests
- Monitor for anomalous betting patterns
- Implement circuit breakers for large payouts

### Integration Checklist

- [ ] Deploy MXE program to Arcium
- [ ] Configure event indexer for bet events
- [ ] Set up secure RPC endpoint for payout queries
- [ ] Update Solana program to verify MXE signatures
- [ ] Test end-to-end flow on devnet
- [ ] Audit MXE computation logic
- [ ] Deploy to mainnet

## 8. Flow Diagram

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │ 1. Create bet payload
       │ 2. Encrypt with Arcium SDK
       ▼
┌─────────────────────┐
│  Solana Program     │
│  (place_bet)        │
└──────┬──────────────┘
       │ 3. Transfer USDC to vault
       │ 4. Emit BetPlacedEvent(encrypted_payload)
       ▼
┌─────────────────────┐
│  Arcium MXE         │
│  (Event Listener)   │
└──────┬──────────────┘
       │ 5. Decrypt payload
       │ 6. Store private bet data
       │ 7. Update hidden totals
       ▼
┌─────────────────────┐
│  MXE State          │
│  user_bets: {...}   │
│  total_yes: XXX     │ ← PRIVATE
│  total_no: XXX      │ ← PRIVATE
└─────────────────────┘

... Time passes, market expires ...

┌─────────────────────┐
│  Authority          │
│  (resolve_market)   │
└──────┬──────────────┘
       │ 8. Submit result (Yes/No)
       ▼
┌─────────────────────┐
│  Solana Program     │
│  (resolve_market)   │
└──────┬──────────────┘
       │ 9. Emit MarketResolvedEvent
       ▼
┌─────────────────────┐
│  Arcium MXE         │
│  (Compute Payouts)  │
└──────┬──────────────┘
       │ 10. Calculate payout per user
       │     payout = (user_amount / winning_total) * total_pool
       ▼
┌─────────────────────┐
│  MXE State          │
│  user_payouts: {...}│ ← PRIVATE
└─────────────────────┘

... User wants to claim ...

┌─────────────┐
│   User      │
└──────┬──────┘
       │ 11. Call claim()
       ▼
┌─────────────────────┐
│  Solana Program     │
│  (claim)            │
└──────┬──────────────┘
       │ 12. Query MXE: get_user_payout(user)
       ▼
┌─────────────────────┐
│  Arcium MXE         │
│  (Query Handler)    │
└──────┬──────────────┘
       │ 13. Return payout amount (only for this user)
       ▼
┌─────────────────────┐
│  Solana Program     │
│  (claim)            │
└──────┬──────────────┘
       │ 14. Transfer USDC from vault to user
       │ 15. Mark position as claimed
       ▼
┌─────────────┐
│   User      │ ← receives USDC
└─────────────┘
```

## 9. Reference Implementation

See:
- `/programs/nexora/src/lib.rs` - Solana program with MXE integration hooks
- `/app/src/lib/arcium-mock.ts` - Mock Arcium client for testing
- `/app/src/lib/nexora-client.ts` - Full client SDK
- `/tests/nexora.ts` - Integration tests

## 10. Additional Resources

- [Arcium Documentation](https://docs.arcium.com)
- [MXE Developer Guide](https://docs.arcium.com/mxe)
- [Solana Program Library](https://spl.solana.com)
- [Anchor Framework](https://www.anchor-lang.com)
