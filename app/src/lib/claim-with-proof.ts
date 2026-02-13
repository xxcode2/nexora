/**
 * NEXORA - Trust-Minimized Claim Integration
 * 
 * This file provides the SECURE claim implementation using Arcium MXE proofs
 * and onchain Ed25519 signature verification.
 * 
 * DO NOT use the old mock-based claim flow.
 */

import {
    PublicKey,
    Transaction,
    SYSVAR_INSTRUCTIONS_PUBKEY,
} from '@solana/web3.js';
import { Program, BN, AnchorProvider } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { Ed25519Program } from '@solana/web3.js';
import { keccak_256 } from '@noble/hashes/sha3';
import { createArciumService } from '../services/ArciumService';

// ============================================================================
// Constants
// ============================================================================

/**
 * MXE Public Key - Must match Anchor program constant
 * TODO: Update after MXE deployment (get from Arcium dashboard)
 */
const MXE_PUBKEY = new Uint8Array([
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
]);

/**
 * USDC Mint (Devnet)
 */
const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

// ============================================================================
// Types
// ============================================================================

interface PayoutProof {
    payout: number;
    nonce: number;
    signature: Uint8Array; // 64 bytes
}

interface ClaimPayoutParams {
    program: Program;
    provider: AnchorProvider;
    market: PublicKey;
    user: PublicKey;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Construct the payout message that MXE signs
 * 
 * Message Format: keccak256(market || user || payout || nonce)
 * 
 * CRITICAL: This MUST match the Anchor program's construct_payout_message()
 * exactly, or signature verification will fail.
 */
function constructPayoutMessage(
    market: PublicKey,
    user: PublicKey,
    payout: number,
    nonce: number
): Uint8Array {
    // Concatenate: market (32) + user (32) + payout (8 LE) + nonce (8 LE)
    const data = Buffer.concat([
        market.toBuffer(), // 32 bytes
        user.toBuffer(), // 32 bytes
        Buffer.from(new BN(payout).toArray('le', 8)), // 8 bytes little-endian
        Buffer.from(new BN(nonce).toArray('le', 8)), // 8 bytes little-endian
    ]);

    // Hash with Keccak-256 (same as Anchor's keccak::hash)
    return keccak_256(data); // Returns 32 bytes
}

// ============================================================================
// Main Claim Function
// ============================================================================

/**
 * Claim payout with cryptographic proof from Arcium MXE
 * 
 * TRUST-MINIMIZED FLOW:
 * 1. Request payout computation from MXE (happens in TEE)
 * 2. Retrieve proof (payout + nonce + signature)
 * 3. Construct message onchain
 * 4. Verify Ed25519 signature against MXE_PUBKEY
 * 5. Transfer verified payout to user
 * 
 * SECURITY:
 * - Frontend cannot forge payouts (no MXE private key)
 * - Payout computed in TEE (confidential + verifiable)
 * - Signature verified onchain (trust-minimized)
 * - Replay protection via nonce tracking
 */
export async function claimPayoutWithProof({
    program,
    provider,
    market,
    user,
}: ClaimPayoutParams): Promise<string> {
    console.log('🔐 Starting trust-minimized claim...');

    // ========================================================================
    // STEP 1: Request Payout Computation from MXE
    // ========================================================================

    const arciumService = createArciumService();

    console.log('📡 Requesting payout computation from Arcium MXE...');
    const { computationId } = await arciumService.requestPayout({
        market: market,
        user: user,
    });

    console.log(`⏳ Computation ID: ${computationId}`);

    // ========================================================================
    // STEP 2: Wait for MXE to Complete Computation
    // ========================================================================

    console.log('⏳ Waiting for MXE to compute payout in TEE...');
    await arciumService.waitForCompletion(computationId, {
        maxWaitMs: 60000, // 60 seconds
        pollIntervalMs: 2000, // Check every 2 seconds
    });

    console.log('✅ MXE computation complete!');

    // ========================================================================
    // STEP 3: Retrieve Payout Proof
    // ========================================================================

    console.log('📥 Retrieving proof from MXE...');
    const result = await arciumService.readPayoutResult(computationId);
    
    const proof: PayoutProof = {
        payout: result.payoutAmount,
        nonce: result.nonce,
        signature: typeof result.signature === 'string' 
            ? Buffer.from(result.signature, 'hex') 
            : result.signature,
    };

    console.log('✅ Proof retrieved:');
    console.log(`   Payout: ${proof.payout}`);
    console.log(`   Nonce: ${proof.nonce}`);
    console.log(`   Signature: ${Buffer.from(proof.signature).toString('hex').slice(0, 16)}...`);

    // ========================================================================
    // STEP 4: Construct Signed Message
    // ========================================================================

    const message = constructPayoutMessage(
        market,
        user,
        proof.payout,
        proof.nonce
    );

    console.log(`📝 Message hash: ${Buffer.from(message).toString('hex').slice(0, 16)}...`);

    // ========================================================================
    // STEP 5: Create Ed25519 Verification Instruction
    // ========================================================================

    console.log('🔏 Creating Ed25519 signature verification instruction...');

    const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
        publicKey: MXE_PUBKEY,
        message: message,
        signature: proof.signature,
    });

    // ========================================================================
    // STEP 6: Get PDAs
    // ========================================================================

    const [userPosition] = PublicKey.findProgramAddressSync(
        [
            Buffer.from('position'),
            market.toBuffer(),
            user.toBuffer(),
        ],
        program.programId
    );

    const [vault] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), market.toBuffer()],
        program.programId
    );

    const userTokenAccount = await getAssociatedTokenAddress(USDC_MINT, user);

    // ========================================================================
    // STEP 7: Build Claim Instruction
    // ========================================================================

    console.log('📋 Building claim_with_proof instruction...');

    const claimIx = await program.methods
        .claimWithProof(
            new BN(proof.payout),
            new BN(proof.nonce),
            Array.from(proof.signature)
        )
        .accounts({
            market,
            userPosition,
            vault,
            userTokenAccount,
            user,
            ixSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
            tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction();

    // ========================================================================
    // STEP 8: Build Transaction (Ed25519 MUST be index 0)
    // ========================================================================

    console.log('🔨 Building transaction...');

    const tx = new Transaction();
    tx.add(ed25519Ix); // MUST be index 0 for verification
    tx.add(claimIx); // Index 1

    // ========================================================================
    // STEP 9: Send Transaction
    // ========================================================================

    console.log('📤 Sending transaction...');

    const signature = await provider.sendAndConfirm(tx);

    console.log('✅ Payout claimed successfully!');
    console.log(`   Transaction: ${signature}`);
    console.log(`   Amount: ${proof.payout} (verified by MXE)`);

    return signature;
}

// ============================================================================
// React Hook Integration
// ============================================================================

/**
 * Hook for using claim functionality in React components
 */
export function useClaimPayout() {
    const handleClaim = async (
        program: Program,
        provider: AnchorProvider,
        market: PublicKey,
        user: PublicKey
    ) => {
        try {
            const signature = await claimPayoutWithProof({
                program,
                provider,
                market,
                user,
            });

            return { success: true, signature };
        } catch (error: any) {
            console.error('❌ Claim failed:', error);

            // Parse Anchor errors
            if (error.message?.includes('NonceAlreadyUsed')) {
                throw new Error('This payout proof has already been used (replay protection)');
            }
            if (error.message?.includes('AlreadyClaimed')) {
                throw new Error('You have already claimed your payout for this market');
            }
            if (error.message?.includes('SignatureMismatch')) {
                throw new Error('Invalid proof signature - payout verification failed');
            }
            if (error.message?.includes('MarketNotResolved')) {
                throw new Error('Market has not been resolved yet');
            }
            if (error.message?.includes('InsufficientVaultBalance')) {
                throw new Error('Vault has insufficient balance for this payout');
            }

            throw error;
        }
    };

    return { claimPayout: handleClaim };
}

// ============================================================================
// Export
// ============================================================================

export { type PayoutProof, type ClaimPayoutParams };
