/**
 * Nexora Arcium Service
 * 
 * High-level service for Arcium MXE integration.
 * Wraps the NexoraArciumClient with application-specific logic.
 * 
 * Official SDK: @arcium-hq/client, @arcium-hq/reader
 * Documentation: https://docs.arcium.com/developers
 */

import { PublicKey } from '@solana/web3.js';
import { NexoraArciumClient, createArciumClient } from '../lib/arcium-sdk-client';

interface BetParams {
  market: PublicKey;
  user: PublicKey;
  side: 'yes' | 'no';
  amount: number;
}

interface PayoutParams {
  market: PublicKey;
  user: PublicKey;
}

export interface PayoutResult {
  payoutAmount: number;
  nonce: number;
  proof: string;
  signature: string;
  userBetAmount?: number;
  totalPool?: number;
}

/**
 * Nexora Arcium Service
 * 
 * Provides high-level methods for confidential prediction market operations:
 * - Submit confidential bets to MXE
 * - Request payout computations
 * - Read computation results
 */
export class NexoraArciumService {
  private client: NexoraArciumClient;

  constructor(client: NexoraArciumClient) {
    this.client = client;
  }

  /**
   * Submit confidential bet to Arcium MXE
   * 
   * This submits the bet to the MXE enclave where it will be stored
   * confidentially. The bet side and amount are encrypted and only
   * accessible within the TEE.
   * 
   * @param params - Bet parameters
   * @returns Arcium computation ID
   */
  async submitBet(params: BetParams): Promise<string> {
    console.log('📤 Submitting bet to Arcium MXE...');
    console.log('Market:', params.market.toBase58());
    console.log('User:', params.user.toBase58());
    console.log('Side:', params.side);
    console.log('Amount:', params.amount);

    const computationId = await this.client.submitBet({
      market: params.market.toBase58(),
      user: params.user.toBase58(),
      side: params.side,
      amount: params.amount,
    });

    console.log('✅ Bet submitted, computation ID:', computationId);
    return computationId;
  }

  /**
   * Request payout computation from MXE
   * 
   * This submits a computation to calculate the user's payout based on
   * their confidential bets stored in the MXE enclave.
   * 
   * @param params - Payout request parameters
   * @returns Computation ID and initial status
   */
  async requestPayout(params: PayoutParams): Promise<{
    computationId: string;
    status: string;
  }> {
    console.log('📤 Requesting payout computation...');
    console.log('Market:', params.market.toBase58());
    console.log('User:', params.user.toBase58());

    const result = await this.client.requestPayout({
      market: params.market.toBase58(),
      user: params.user.toBase58(),
    });

    console.log('✅ Payout computation submitted:', result.computationId);
    return result;
  }

  /**
   * Read payout computation result
   * 
   * Reads the result of a payout computation. The result includes
   * the payout amount and cryptographic proof/signature from the MXE.
   * 
   * @param computationId - Computation ID from requestPayout
   * @returns Payout result with proof
   */
  async readPayoutResult(computationId: string): Promise<PayoutResult> {
    console.log('📥 Reading payout result...');
    console.log('Computation ID:', computationId);

    const result = await this.client.readPayoutResult(computationId);

    console.log('✅ Payout result:', result.payoutAmount);
    return result;
  }

  /**
   * Get computation status
   * 
   * @param computationId - Computation ID to check
   * @returns Status (pending, queued, running, completed, failed)
   */
  async getStatus(computationId: string): Promise<string> {
    return await this.client.getComputationStatus(computationId);
  }

  /**
   * Wait for computation to complete
   * 
   * Polls the computation status until it completes or times out.
   * 
   * @param computationId - Computation ID to wait for
   * @param options - Timeout and poll interval
   */
  async waitForCompletion(
    computationId: string,
    options: {
      maxWaitMs?: number;
      pollIntervalMs?: number;
    } = {}
  ): Promise<void> {
    console.log('⏳ Waiting for computation to complete...');
    await this.client.waitForCompletion(computationId, options);
  }

  /**
   * Submit bet and wait for processing
   * 
   * Convenience method that submits a bet and waits for it to be processed.
   * 
   * @param params - Bet parameters
   * @param waitForCompletion - Whether to wait for MXE processing
   * @returns Computation ID
   */
  async submitBetAndWait(
    params: BetParams,
    waitForCompletion: boolean = false
  ): Promise<string> {
    const computationId = await this.submitBet(params);

    if (waitForCompletion) {
      await this.waitForCompletion(computationId, {
        maxWaitMs: 30000, // 30 seconds
      });
    }

    return computationId;
  }

  /**
   * Request payout and wait for result
   * 
   * Convenience method that requests payout and waits for the result.
   * 
   * @param params - Payout request parameters
   * @returns Payout result with proof
   */
  async requestPayoutAndWait(params: PayoutParams): Promise<PayoutResult> {
    const { computationId } = await this.requestPayout(params);

    await this.waitForCompletion(computationId, {
      maxWaitMs: 30000, // 30 seconds
    });

    return await this.readPayoutResult(computationId);
  }

  /**
   * Check if Arcium MXE is healthy
   * 
   * @returns True if MXE is responding
   */
  async healthCheck(): Promise<boolean> {
    try {
      return await this.client.healthCheck();
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }
}

/**
 * Factory function to create NexoraArciumService
 * 
 * Reads configuration from environment variables:
 * - VITE_ARCIUM_NETWORK
 * - VITE_ARCIUM_API_KEY
 * - VITE_ARCIUM_MXE_ENCLAVE_ID
 * 
 * @returns Configured service instance
 * @throws Error if configuration is missing
 */
export function createArciumService(): NexoraArciumService {
  const network = import.meta.env.VITE_ARCIUM_NETWORK;
  const apiKey = import.meta.env.VITE_ARCIUM_API_KEY;
  const enclaveId = import.meta.env.VITE_ARCIUM_MXE_ENCLAVE_ID;

  if (!network || !apiKey || !enclaveId) {
    throw new Error(
      'Arcium configuration missing. Set VITE_ARCIUM_NETWORK, VITE_ARCIUM_API_KEY, and VITE_ARCIUM_MXE_ENCLAVE_ID in .env.local'
    );
  }

  const client = createArciumClient({
    network: network as 'testnet' | 'devnet' | 'mainnet',
    apiKey,
    enclaveId,
  });

  return new NexoraArciumService(client);
}

/**
 * Check if Arcium is configured and available
 * 
 * @returns True if all required configuration is present
 */
export function isArciumConfigured(): boolean {
  const network = import.meta.env.VITE_ARCIUM_NETWORK;
  const apiKey = import.meta.env.VITE_ARCIUM_API_KEY;
  const enclaveId = import.meta.env.VITE_ARCIUM_MXE_ENCLAVE_ID;

  return !!(network && apiKey && enclaveId);
}

export default NexoraArciumService;
