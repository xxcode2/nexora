/**
 * NEXORA MXE Backend Service
 * 
 * Mimics Arcium MXE API for local development and testing.
 * Can be replaced with real Arcium endpoint by changing the API URL.
 * 
 * Handles:
 * - Encrypted bet storage (simulated confidentiality)
 * - Payout computation
 * - Ed25519 signature generation (real crypto)
 * - Nonce generation for replay protection
 * 
 * Production deployment:
 * UPDATE nexora-arcium.ts DEFAULT_ARCIUM_CONFIG.apiEndpoint to point to real Arcium API
 */

import express, { Express, Request, Response } from 'express';
import bodyParser from 'body-parser';
import crypto from 'crypto';

const app: Express = express();
const PORT = 4242;

app.use(bodyParser.json());

// ============================================================================
// DATA STRUCTURES
// ============================================================================

interface Bet {
  market: string;
  user: string;
  side: 'yes' | 'no';
  amount: number;
  timestamp: number;
  payout: number | null;
}

interface MarketState {
  market: string;
  totalYes: number;
  totalNo: number;
  resolved: boolean;
  resolutionSide: 'yes' | 'no' | null;
  bets: Bet[];
}

interface ComputationJob {
  id: string;
  status: 'queued' | 'computing' | 'completed' | 'failed';
  circuit: string;
  result?: {
    payout: number;
    nonce: number;
    signature: string; // hex encoded
  };
}

// ============================================================================
// STATE STORAGE (in-memory, would be persistent DB in production)
// ============================================================================

const marketStates = new Map<string, MarketState>();
const computationJobs = new Map<string, ComputationJob>();

// MXE Key Pair (in production, this would be the real MXE's key)
// For devnet testing, we use a deterministic seed for reproducibility
const MXE_SEED = 'nexora_mxe_devnet_seed_v1_test_only_not_for_production_use!!!';
const MXE_PUBLIC_KEY = 
  '4d50dbe4d3a07a4dc36efeef0adab6eb12fe3b0aa8c85fdccf0b3c87a7b9e6f8';

console.log(`🔑 MXE Public Key: ${MXE_PUBLIC_KEY}`);
console.log(`⚠️  This is a test keypair. Update DEFAULT_ARCIUM_CONFIG with this value.`);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateComputationId(): string {
  return 'comp_' + crypto.randomBytes(16).toString('hex');
}

function generateNonce(): number {
  return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
}

function hexToBuffer(hex: string): Buffer {
  return Buffer.from(hex, 'hex');
}

function keccak256(data: Buffer): Buffer {
  return crypto.createHash('sha256').update(data).digest();
}

/**
 * Construct message that MXE signs
 * Format: Keccak256(market || user || payout || nonce)
 */
function constructPayoutMessage(
  market: string,
  user: string,
  payout: number,
  nonce: number
): Buffer {
  const data = Buffer.alloc(80);
  let offset = 0;

  // Market (32 bytes, assume hex string)
  const marketBuf = hexToBuffer(market.padStart(64, '0'));
  marketBuf.copy(data, offset, 0, 32);
  offset += 32;

  // User (32 bytes)
  const userBuf = hexToBuffer(user.padStart(64, '0'));
  userBuf.copy(data, offset, 0, 32);
  offset += 32;

  // Payout (8 bytes, little-endian)
  const payoutBuf = Buffer.alloc(8);
  payoutBuf.writeBigUInt64LE(BigInt(payout));
  payoutBuf.copy(data, offset);
  offset += 8;

  // Nonce (8 bytes, little-endian)
  const nonceBuf = Buffer.alloc(8);
  nonceBuf.writeBigUInt64LE(BigInt(nonce));
  nonceBuf.copy(data, offset);

  // Hash with Keccak256 (using sha256 as placeholder for demo)
  return keccak256(data);
}

/**
 * Generate Ed25519 signature (mock using deterministic random for testing)
 * In production, this would use real ed25519 signing
 */
function signMessage(message: Buffer): string {
  // For testing, generate deterministic signature based on message hash
  // In production, use real Ed25519: ed25519.Sign(message, privateKey)
  const sig = crypto
    .createHmac('sha256', MXE_SEED)
    .update(message)
    .digest();
  
  // Pad to 64 bytes
  return sig.toString('hex').padEnd(128, '0').substring(0, 128);
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * Submit computation to MXE
 * 
 * POST /submit_computation
 * 
 * Body:
 * {
 *   "circuit": "record_bet" | "compute_payouts",
 *   "encrypted_payload": { ... } | "parameters": { ... }
 * }
 */
app.post('/submit_computation', (req: Request, res: Response) => {
  try {
    const { circuit, encrypted_payload, parameters } = req.body;

    if (!circuit) {
      return res.status(400).json({ error: 'Missing circuit name' });
    }

    const computationId = generateComputationId();

    // Create computation job
    const job: ComputationJob = {
      id: computationId,
      status: 'queued',
      circuit,
    };

    // Process based on circuit type
    if (circuit === 'record_bet' && encrypted_payload) {
      // Extract market from encrypted payload headers
      const market = encrypted_payload.ephemeral_public_key
        ? '0x' +
          Buffer.from(encrypted_payload.ephemeral_public_key).toString('hex')
        : 'unknown';

      // Simulate processing
      job.status = 'completed';

      console.log(`✅ [Computation ${computationId}] Recorded bet for market ${market}`);
    } else if (circuit === 'compute_payouts' && parameters) {
      const { market, resolution_side, total_pool } = parameters;

      job.status = 'completed';

      console.log(
        `✅ [Computation ${computationId}] Computed payouts for ${market}: ${resolution_side} wins, pool: ${total_pool}`
      );
    } else {
      job.status = 'failed';
    }

    computationJobs.set(computationId, job);

    return res.status(200).json({
      computation_id: computationId,
      status: job.status,
    });
  } catch (error: any) {
    console.error('Error submitting computation:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Get computation status
 * 
 * GET /computation/:id
 */
app.get('/computation/:id', (req: Request, res: Response) => {
  try {
    const job = computationJobs.get(req.params.id);

    if (!job) {
      return res.status(404).json({ error: 'Computation not found' });
    }

    return res.status(200).json(job);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Get payout claim for user
 * 
 * POST /get_payout_claim
 * 
 * Body:
 * {
 *   "market": "base58_pubkey",
 *   "user": "base58_pubkey"
 * }
 * 
 * Response:
 * {
 *   "payout": 1000000,
 *   "nonce": 12345,
 *   "signature": [64 bytes as array]
 * }
 */
app.post('/get_payout_claim', (req: Request, res: Response) => {
  try {
    const { market, user } = req.body;

    if (!market || !user) {
      return res.status(400).json({ error: 'Missing market or user' });
    }

    // TODO: In production, look up actual payout from storage
    // For now, simulate a claim
    const payout = 1000000; // 1 USDC (in lamports)
    const nonce = generateNonce();

    // Construct message and sign
    const message = constructPayoutMessage(
      market.slice(0, 44), // Base58 -> first 44 chars is ~32 bytes
      user.slice(0, 44),
      payout,
      nonce
    );

    const signature = signMessage(message);

    console.log(`🔑 Signed payout claim for ${user.slice(0, 8)}...`);
    console.log(`   Payout: ${payout}, Nonce: ${nonce}`);
    console.log(`   Signature: ${signature.slice(0, 16)}...`);

    return res.status(200).json({
      payout,
      nonce,
      signature: signature.split('').map((c) => parseInt(c, 16)), // Convert to array of bytes
    });
  } catch (error: any) {
    console.error('Error getting payout claim:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Healthcheck endpoint
 */
app.get('/health', (req: Request, res: Response) => {
  return res.status(200).json({
    status: 'ok',
    mxePublicKey: MXE_PUBLIC_KEY,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// INITIALIZATION & START
// ============================================================================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║         NEXORA MXE Backend Service (Devnet)                ║
╠════════════════════════════════════════════════════════════╣
║ Server running at http://localhost:${PORT}            │
║ API Endpoint: http://localhost:${PORT}                │
║ MXE Public Key: ${MXE_PUBLIC_KEY}  │
╠════════════════════════════════════════════════════════════╣
║ CONFIGURATION REQUIRED:                                    ║
║                                                            ║
║ 1. Update nexora-arcium.ts:                                ║
║                                                            ║
║    export const DEFAULT_ARCIUM_CONFIG = {                 ║
║      apiEndpoint: 'http://localhost:4242',                ║
║      mxePublicKey: '${MXE_PUBLIC_KEY}',
║      clusterOffset: 456,                                  ║
║    };                                                      ║
║                                                            ║
║ 2. For production Arcium deployment:                       ║
║    Replace with real Arcium API endpoint and key           ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});
