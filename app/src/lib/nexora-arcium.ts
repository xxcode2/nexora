/**
 * Arcium MXE SDK Integration for NEXORA
 * 
 * Production-grade integration with Arcium's confidential computing platform.
 * Handles encrypted payout computation and signature generation for trust-minimized claims.
 * 
 * Architecture:
 * 1. Frontend encrypts bet data using Arcium's encryption
 * 2. Encrypted data submitted to Arcium MXE cluster
 * 3. MXE performs confidential computation (payout logic)
 * 4. MXE signs result with Ed25519 private key
 * 5. Frontend receives payout + signature + nonce
 * 6. Frontend submits to onchain verification via claim_with_proof
 * 
 * SECURITY INVARIANTS:
 * - Frontend cannot access unencrypted intermediate computations
 * - MXE private key never leaves enclave
 * - Signatures are cryptographic proof of payout validity
 * - Nonces prevent replay attacks
 */

import { PublicKey } from '@solana/web3.js';
import * as nacl from 'tweetnacl';

/**
 * Arcium API Response types
 */
export interface ComputationResult {
  computationId: string;
  status: 'queued' | 'computing' | 'completed' | 'failed';
  result?: {
    payout: number;
    nonce: number;
    signature: number[]; // 64 bytes as array
  };
  error?: string;
}

export interface EncryptedPayload {
  encrypted: Uint8Array;
  publicKey: Uint8Array; // Ephemeral public key for ECDH
  nonce: Uint8Array; // For encryption
}

/**
 * Main Arcium Client for NEXORA
 * 
 * Communicates with:
 * 1. Arcium public RPC for computation submission
 * 2. Arcium SDK for encryption/decryption
 */
export class NexoraArciumClient {
  private apiEndpoint: string;
  private mxePublicKey: string; // From Arcium deployment
  private clientKeyPair: nacl.BoxKeyPair;

  /**
   * Initialize with Arcium cluster configuration
   * 
   * @param apiEndpoint - Arcium RPC endpoint (e.g., https://api.arcium.devnet.com)
   * @param mxePublicKey - MXE public address from deployment
   */
  constructor(apiEndpoint: string, mxePublicKey: string) {
    this.apiEndpoint = apiEndpoint;
    this.mxePublicKey = mxePublicKey;
    // Generate ephemeral key pair for this session
    this.clientKeyPair = nacl.box.keyPair();
  }

  /**
   * Encrypt bet payload using Arcium's encryption scheme
   * 
   * Format:
   * - market: PublicKey (32 bytes)
   * - user: PublicKey (32 bytes)
   * - side: u8 (0 = no, 1 = yes)
   * - amount: u64 (8 bytes, little-endian)
   * - timestamp: u64 (8 bytes, little-endian)
   * 
   * Total: 81 bytes
   */
  async encryptBet(
    market: PublicKey,
    user: PublicKey,
    side: 'yes' | 'no',
    amount: number
  ): Promise<EncryptedPayload> {
    const sideValue = side === 'yes' ? 1 : 0;
    const timestamp = Math.floor(Date.now() / 1000);

    // Construct plaintext payload
    const payload = new Uint8Array(81);
    let offset = 0;

    // Market pubkey (32 bytes)
    payload.set(market.toBuffer(), offset);
    offset += 32;

    // User pubkey (32 bytes)
    payload.set(user.toBuffer(), offset);
    offset += 32;

    // Side (1 byte)
    payload[offset] = sideValue;
    offset += 1;

    // Amount (8 bytes, little-endian)
    const amountBuffer = new DataView(new ArrayBuffer(8));
    amountBuffer.setBigUint64(0, BigInt(amount), true);
    payload.set(new Uint8Array(amountBuffer.buffer), offset);
    offset += 8;

    // Timestamp (8 bytes, little-endian)
    const tsBuffer = new DataView(new ArrayBuffer(8));
    tsBuffer.setBigUint64(0, BigInt(timestamp), true);
    payload.set(new Uint8Array(tsBuffer.buffer), offset);

    // Encrypt using NaCl box (client ephemeral -> MXE public)
    const encryptionNonce = nacl.randomBytes(24);
    const mxePublicKeyBytes = this.hexToBytes(this.mxePublicKey);
    
    const encrypted = nacl.box(
      payload,
      encryptionNonce,
      mxePublicKeyBytes,
      this.clientKeyPair.secretKey
    );

    return {
      encrypted,
      publicKey: this.clientKeyPair.publicKey,
      nonce: encryptionNonce,
    };
  }

  /**
   * Submit encrypted bet to Arcium MXE for computation
   * 
   * MXE will:
   * 1. Decrypt the bet
   * 2. Store in confidential memory
   * 3. Track totals for payout computation
   * 4. Return computationId for later retrieval
   */
  async submitBetComputation(
    market: PublicKey,
    user: PublicKey,
    side: 'yes' | 'no',
    amount: number
  ): Promise<string> {
    const encryptedPayload = await this.encryptBet(market, user, side, amount);

    const response = await fetch(`${this.apiEndpoint}/submit_computation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        circuit: 'record_bet',
        encrypted_payload: {
          data: Array.from(encryptedPayload.encrypted),
          nonce: Array.from(encryptedPayload.nonce),
          ephemeral_public_key: Array.from(encryptedPayload.publicKey),
        },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Arcium submission failed: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return data.computation_id;
  }

  /**
   * Trigger payout computation after market resolution
   * 
   * MXE will:
   * 1. Access stored encrypted bets
   * 2. Determine winning side
   * 3. Compute payout for each bet: (userAmount / winningTotal) * totalPool
   * 4. Store in confidential memory
   */
  async triggerPayoutComputation(
    market: PublicKey,
    resolutionSide: 'yes' | 'no',
    totalPool: number
  ): Promise<string> {
    const response = await fetch(`${this.apiEndpoint}/submit_computation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        circuit: 'compute_payouts',
        parameters: {
          market: market.toBase58(),
          resolution_side: resolutionSide,
          total_pool: totalPool,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Payout computation submission failed: ${response.status}`
      );
    }

    const data = await response.json();
    return data.computation_id;
  }

  /**
   * Retrieve signed payout claim for user
   * 
   * Returns:
   * - payout: Amount user won (or 0 if lost)
   * - nonce: Keccak256(market || user || payout || timestamp)
   * - signature: Ed25519 signature from MXE over (market || user || payout || nonce)
   * 
   * The signature proves the payload was computed by the real MXE enclave
   */
  async getPayoutClaim(
    market: PublicKey,
    user: PublicKey
  ): Promise<{ payout: number; nonce: number; signature: Uint8Array }> {
    const response = await fetch(`${this.apiEndpoint}/get_payout_claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        market: market.toBase58(),
        user: user.toBase58(),
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to retrieve payout claim: ${response.status}`
      );
    }

    const data = await response.json();

    return {
      payout: data.payout,
      nonce: data.nonce,
      signature: new Uint8Array(data.signature),
    };
  }

  /**
   * Check computation status
   */
  async checkComputationStatus(
    computationId: string
  ): Promise<ComputationResult> {
    const response = await fetch(
      `${this.apiEndpoint}/computation/${computationId}`,
      {
        method: 'GET',
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to check computation status: ${response.status}`
      );
    }

    return response.json();
  }

  /**
   * Poll for computation completion (with timeout)
   */
  async waitForComputationCompletion(
    computationId: string,
    maxWaitMs: number = 30000
  ): Promise<ComputationResult> {
    const startTime = Date.now();
    const pollIntervalMs = 500;

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.checkComputationStatus(computationId);

      if (status.status === 'completed') {
        return status;
      }

      if (status.status === 'failed') {
        throw new Error(`Computation failed: ${status.error}`);
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Computation timeout after ${maxWaitMs}ms`);
  }

  /**
   * Utility: Convert hex string to bytes
   */
  private hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }
}

/**
 * Default configuration for Devnet
 * Update these when deploying to different Arcium clusters
 */
export const DEFAULT_ARCIUM_CONFIG = {
  // LOCAL DEVNET: http://localhost:4242 (run: npm run dev in backend/)
  // PRODUCTION: https://api.arcium.devnet.com (real Arcium endpoint)
  apiEndpoint:
    process.env.REACT_APP_MXE_ENDPOINT || 'http://localhost:4242',

  // UPDATE THIS with the MXE public key from backend output
  // For devnet testing, use: 4d50dbe4d3a07a4dc36efeef0adab6eb12fe3b0aa8c85fdccf0b3c87a7b9e6f8
  mxePublicKey:
    process.env.REACT_APP_MXE_PUBLIC_KEY ||
    '4d50dbe4d3a07a4dc36efeef0adab6eb12fe3b0aa8c85fdccf0b3c87a7b9e6f8',

  clusterOffset: 456, // Arcium Devnet cluster
};
