/**
 * ARCIUM SDK INTEGRATION - REAL IMPLEMENTATION
 * 
 * This file uses the official Arcium SDK packages:
 * - @arcium-hq/client - For submitting computations
 * - @arcium-hq/reader - For reading computation results
 * 
 * Installation:
 * npm install @arcium-hq/client @arcium-hq/reader
 */

// ✅ OFFICIAL ARCIUM SDK IMPORTS
import { ArciumClient } from '@arcium-hq/client';
import { ArciumReader } from '@arcium-hq/reader';

interface ArciumSDKConfig {
  /** Arcium network (testnet, devnet, mainnet) */
  network: 'testnet' | 'devnet' | 'mainnet';
  
  /** API key from Arcium dashboard */
  apiKey: string;
  
  /** MXE enclave ID */
  enclaveId: string;
  
  /** Optional: Custom endpoint */
  endpoint?: string;
}

interface ComputationResult {
  /** Computation ID */
  id: string;
  
  /** Status: pending, queued, running, completed, failed */
  status: string;
  
  /** Output data (JSON string) */
  output?: string;
  
  /** Error message if failed */
  error?: string;
}

interface ConfidentialBet {
  market: string;
  user: string;
  side: 'yes' | 'no';
  amount: number;
  timestamp: number;
  nonce: string;
}

interface PayoutResult {
  payoutAmount: number;
  proof: string;
  signature: string;
  userBetAmount?: number;
  totalPool?: number;
}

/**
 * Nexora Arcium SDK Client
 * 
 * This class wraps official Arcium SDK (@arcium-hq/client, @arcium-hq/reader)
 * for confidential bet operations.
 * 
 * Official Docs: https://docs.arcium.com/developers
 * TypeScript API: https://ts.arcium.com/api/
 */
export class NexoraArciumClient {
  private client: ArciumClient;
  private reader: ArciumReader;
  private config: ArciumSDKConfig;

  constructor(config: ArciumSDKConfig) {
    this.config = config;
    
    // Initialize official Arcium client
    this.client = new ArciumClient({
      network: config.network,
      apiKey: config.apiKey,
      ...(config.endpoint && { endpoint: config.endpoint }),
    });
    
    // Initialize reader for computation results
    this.reader = new ArciumReader({
      network: config.network,
      apiKey: config.apiKey,
      ...(config.endpoint && { endpoint: config.endpoint }),
    });
    
    console.log('✅ Arcium client initialized:', config.network);
  }

  /**
   * Submit confidential bet to Arcium MXE
   * 
   * This submits a computation to the MXE enclave where the bet will be
   * stored confidentially. The bet side and amount are encrypted and only
   * accessible within the TEE.
   * 
   * @param payload - Bet data (will be encrypted by MXE)
   * @returns Computation ID
   */
  async submitBet(payload: {
    market: string;
    user: string;
    side: 'yes' | 'no';
    amount: number;
  }): Promise<string> {
    const betData: ConfidentialBet = {
      market: payload.market,
      user: payload.user,
      side: payload.side,
      amount: payload.amount,
      timestamp: Date.now(),
      nonce: this.generateNonce(),
    };

    // Submit computation to MXE
    // The MXE program 'nexora_record_bet' will store this confidentially
    const computation = await this.client.submitComputation({
      program: 'nexora_record_bet',
      input: JSON.stringify(betData),
      enclaveId: this.config.enclaveId,
      metadata: {
        marketId: payload.market,
        userId: payload.user,
        operation: 'record_bet',
      },
    });

    console.log('✅ Bet submitted to Arcium:', computation.id);
    return computation.id;
  }

  /**
   * Request payout computation from MXE
   * 
   * This submits a computation to calculate the user's payout based on
   * their confidential bets stored in the MXE enclave.
   * 
   * @param request - Market and user to compute payout for
   * @returns Computation ID and status
   */
  async requestPayout(request: {
    market: string;
    user: string;
  }): Promise<{
    computationId: string;
    status: string;
  }> {
    // Submit payout computation to MXE
    const computation = await this.client.submitComputation({
      program: 'nexora_compute_payout',
      input: JSON.stringify({
        market: request.market,
        user: request.user,
      }),
      enclaveId: this.config.enclaveId,
      metadata: {
        marketId: request.market,
        userId: request.user,
        operation: 'compute_payout',
      },
    });

    console.log('✅ Payout computation submitted:', computation.id);
    return {
      computationId: computation.id,
      status: computation.status || 'pending',
    };
  }

  /**
   * Read payout computation result
   * 
   * Reads the result of a payout computation. The result includes
   * the payout amount and cryptographic proof/signature from the MXE.
   * 
   * @param computationId - Computation ID from requestPayout
   * @returns Payout result with proof and signature
   */
  async readPayoutResult(computationId: string): Promise<PayoutResult> {
    // Read computation result using reader
    const result = await this.reader.readComputationResult(computationId);

    if (result.status !== 'completed') {
      throw new Error(`Computation not completed: ${result.status}`);
    }

    if (result.error) {
      throw new Error(`Computation error: ${result.error}`);
    }

    if (!result.output) {
      throw new Error('No output from computation');
    }

    // Parse output
    const output = JSON.parse(result.output);

    return {
      payoutAmount: output.payoutAmount,
      proof: output.proof,
      signature: output.signature,
      userBetAmount: output.userBetAmount,
      totalPool: output.totalPool,
    };
  }

  /**
   * Check computation status
   * 
   * @param computationId - Computation ID to check
   * @returns Status string (pending, queued, running, completed, failed)
   */
  async getComputationStatus(computationId: string): Promise<string> {
    const status = await this.client.getComputationStatus(computationId);
    return status || 'unknown';
  }

  /**
   * Wait for computation to complete
   * 
   * Polls the computation status until it completes or times out.
   * 
   * @param computationId - Computation ID to wait for
   * @param options - Timeout and poll interval options
   */
  async waitForCompletion(
    computationId: string,
    options: {
      maxWaitMs?: number;
      pollIntervalMs?: number;
    } = {}
  ): Promise<void> {
    const maxWait = options.maxWaitMs || 30000; // 30 seconds default
    const pollInterval = options.pollIntervalMs || 1000; // 1 second default
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const status = await this.getComputationStatus(computationId);

      if (status === 'completed') {
        console.log('✅ Computation completed:', computationId);
        return;
      } else if (status === 'failed') {
        throw new Error('Computation failed');
      }

      console.log(`⏳ Waiting for computation: ${status}`);
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error('Computation timeout');
  }

  /**
   * Check MXE health status
   * 
   * @returns True if MXE is reachable and healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try to get a test computation status to verify connectivity
      await this.client.getComputationStatus('health-check');
      return true;
    } catch (error) {
      console.error('MXE health check failed:', error);
      return false;
    }
  }

  /**
   * Generate unique nonce for bet identification
   */
  private generateNonce(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Factory function for creating Arcium client
 * 
 * Usage:
 * ```typescript
 * const arciumClient = createArciumClient({
 *   mxeEndpoint: 'https://mxe.arcium.com/devnet',
 *   networkId: 'devnet',
 * });
 * ```
 */
export function createArciumClient(config: ArciumSDKConfig): NexoraArciumClient {
  return new NexoraArciumClient(config);
}

/**
 * Helper: Check if Arcium SDK is properly configured
 * 
 * @returns True if all required configuration is present
 */
export function isArciumSDKConfigured(): boolean {
  try {
    const network = import.meta.env.VITE_ARCIUM_NETWORK;
    const apiKey = import.meta.env.VITE_ARCIUM_API_KEY;
    const enclaveId = import.meta.env.VITE_ARCIUM_MXE_ENCLAVE_ID;

    return !!(network && apiKey && enclaveId);
  } catch (error) {
    console.error('Error checking Arcium configuration:', error);
    return false;
  }
}

export default NexoraArciumClient;
