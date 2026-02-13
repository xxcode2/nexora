/**
 * Mock Arcium MXE Client for Devnet Testing
 * 
 * In production, replace with actual Arcium SDK.
 * This mock simulates confidential computation locally.
 */

interface BetData {
  side: 'yes' | 'no';
  amount: number;
  payout: number | null;
}

interface MarketState {
  totalYes: number;
  totalNo: number;
  resolved: boolean;
}

export class ArciumMockClient {
  private bets: Map<string, BetData> = new Map();
  private marketStates: Map<string, MarketState> = new Map();

  /**
   * Mock encryption - in production, use Arcium's TEE encryption
   */
  async encrypt(payload: string): Promise<Uint8Array> {
    // Simple encoding for mock
    return new TextEncoder().encode(btoa(payload));
  }

  /**
   * Mock decryption
   */
  async decrypt(encrypted: Uint8Array): Promise<any> {
    const decoded = atob(new TextDecoder().decode(encrypted));
    return JSON.parse(decoded);
  }

  /**
   * Record a bet in confidential storage
   */
  async recordBet(
    market: string,
    user: string,
    side: 'yes' | 'no',
    amount: number
  ): Promise<void> {
    const key = `${market}:${user}`;
    const existing = this.bets.get(key);

    if (existing) {
      // User adding to existing position
      if (existing.side !== side) {
        throw new Error('Cannot change bet side');
      }
      existing.amount += amount;
    } else {
      // New bet
      this.bets.set(key, {
        side,
        amount,
        payout: null,
      });
    }

    // Update market state
    const state = this.marketStates.get(market) || {
      totalYes: 0,
      totalNo: 0,
      resolved: false,
    };

    if (side === 'yes') {
      state.totalYes += amount;
    } else {
      state.totalNo += amount;
    }

    this.marketStates.set(market, state);

    console.log('📊 [Arcium Mock] Bet recorded:', {
      market,
      user: `${user.slice(0, 4)}...${user.slice(-4)}`,
      side,
      amount,
      totalYes: state.totalYes,
      totalNo: state.totalNo,
    });
  }

  /**
   * Compute payouts after market resolution
   * This happens in TEE - individual bets remain private
   */
  async computePayouts(
    market: string,
    result: 'yes' | 'no',
    totalPool: number
  ): Promise<void> {
    const state = this.marketStates.get(market);
    if (!state) {
      throw new Error('Market not found');
    }

    const winningTotal = result === 'yes' ? state.totalYes : state.totalNo;

    if (winningTotal === 0) {
      console.warn('⚠️ [Arcium Mock] No winning bets');
      return;
    }

    // Compute payout for each user
    for (const [key, bet] of this.bets.entries()) {
      if (key.startsWith(market + ':')) {
        if (bet.side === result) {
          // Winner: proportional share
          bet.payout = Math.floor((bet.amount / winningTotal) * totalPool);
          console.log('✅ [Arcium Mock] Winner payout computed:', {
            user: key.split(':')[1].slice(0, 8) + '...',
            amount: bet.amount,
            payout: bet.payout,
          });
        } else {
          // Loser: no payout
          bet.payout = 0;
          console.log('❌ [Arcium Mock] Loser (no payout):', {
            user: key.split(':')[1].slice(0, 8) + '...',
            amount: bet.amount,
          });
        }
      }
    }

    state.resolved = true;
    this.marketStates.set(market, state);
  }

  /**
   * Get payout for specific user
   * In production, this would be a secure query to MXE
   */
  async getUserPayout(market: string, user: string): Promise<number> {
    const key = `${market}:${user}`;
    const bet = this.bets.get(key);

    if (!bet) {
      return 0;
    }

    if (bet.payout === null) {
      throw new Error('Payouts not yet computed');
    }

    return bet.payout;
  }

  /**
   * Get market state (for debugging)
   * In production, this info would be PRIVATE
   */
  getMarketState(market: string): MarketState | undefined {
    return this.marketStates.get(market);
  }

  /**
   * Clear all data (for testing)
   */
  reset(): void {
    this.bets.clear();
    this.marketStates.clear();
  }
}
