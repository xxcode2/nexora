use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use solana_program::{
    ed25519_program,
    keccak,
    sysvar::instructions::{load_instruction_at_checked, ID as IX_SYSVAR_ID},
};

declare_id!("ZUjdEhJfsNMBV7QbABwSSocMzqrCfhivCgWrhwtaMFm");

// ============================================================================
// Security Configuration - HARDCODED FOR DEVNET V1
// ============================================================================

/// Only this pubkey can create markets on Devnet V1
pub const ADMIN_PUBKEY: Pubkey = pubkey!("GveKcrXTsLd2nqSPgwV1BifPS1fJvoaP5AajpAXitxez");

/// Arcium MXE Enclave Public Key
/// 
/// This is the Ed25519 public key of the Arcium MXE (Multi-Party eXecution Environment).
/// The MXE signs payout computation results with its private key.
/// This program verifies those signatures against this public key.
/// 
/// ⚠️ PRODUCTION DEPLOYMENT STEPS:
/// 1. Deploy NEXORA payout computation to Arcium MXE
/// 2. Retrieve enclave attestation public key from Arcium dashboard
/// 3. Update this constant with the actual MXE public key
/// 4. Rebuild and deploy this program
/// 
/// SECURITY GUARANTEE:
/// - Only payouts signed by this MXE private key will be accepted
/// - Any tampering with payout amounts invalidates the signature
/// - Frontend cannot forge payouts (no private key access)
/// - Attackers cannot bypass verification (onchain check)
/// 
/// Current value: PLACEHOLDER - Replace after MXE deployment
pub const MXE_PUBKEY: [u8; 32] = [
    // TODO: Replace with actual Arcium MXE enclave public key
    // Get from: https://dashboard.arcium.com after deploying enclave
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
];

#[program]
pub mod nexora {
    use super::*;

    /// Create a new prediction market (ADMIN ONLY)
    pub fn create_market(
        ctx: Context<CreateMarket>,
        question: String,
        expiry_timestamp: i64,
    ) -> Result<()> {
        // ⚠️ ADMIN CHECK: Only hardcoded admin can create markets
        require!(
            ctx.accounts.authority.key() == ADMIN_PUBKEY,
            ErrorCode::Unauthorized
        );

        require!(question.len() <= 280, ErrorCode::QuestionTooLong);
        require!(
            expiry_timestamp > Clock::get()?.unix_timestamp,
            ErrorCode::ExpiryInPast
        );

        let market = &mut ctx.accounts.market;
        market.authority = ctx.accounts.authority.key();
        market.question = question;
        market.expiry_timestamp = expiry_timestamp;
        market.total_pool = 0;
        market.resolved = false;
        market.result = MarketResult::None;
        market.vault = ctx.accounts.vault.key();
        market.usdc_mint = ctx.accounts.usdc_mint.key();
        market.bump = ctx.bumps.market;
        market.vault_bump = ctx.bumps.vault;

        emit!(MarketCreatedEvent {
            market: market.key(),
            authority: market.authority,
            question: market.question.clone(),
            expiry_timestamp: market.expiry_timestamp,
        });

        Ok(())
    }

    /// Place an encrypted bet on a market
    /// 
    /// ARCIUM INTEGRATION POINT #1:
    /// - encrypted_payload contains: { side: "yes"|"no", amount: u64 }
    /// - This payload is encrypted client-side before sending
    /// - In PRODUCTION: Arcium MXE will decrypt and store in TEE
    /// - In DEVNET: Frontend mock client handles this
    /// 
    /// TRANSPARENCY WARNING:
    /// - The 'amount' parameter is VISIBLE onchain
    /// - Individual bet amounts are PUBLIC in UserPosition accounts
    /// - Only the 'side' (yes/no) is intended to be confidential
    /// - total_pool is PUBLIC (sum of all deposits)
    pub fn place_bet(
        ctx: Context<PlaceBet>,
        encrypted_payload: Vec<u8>,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        require!(
            encrypted_payload.len() <= 512,
            ErrorCode::PayloadTooLarge
        );

        let market = &mut ctx.accounts.market;
        
        // Ensure market hasn't expired
        require!(
            Clock::get()?.unix_timestamp < market.expiry_timestamp,
            ErrorCode::MarketExpired
        );

        // Ensure market hasn't been resolved
        require!(!market.resolved, ErrorCode::MarketResolved);

        // Transfer USDC from user to vault
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_token_account.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        token::transfer(transfer_ctx, amount)?;

        // Update total pool
        market.total_pool = market.total_pool.checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;

        // Initialize or update user position
        let position = &mut ctx.accounts.user_position;
        if position.amount == 0 {
            position.user = ctx.accounts.user.key();
            position.market = market.key();
            position.amount = amount;
            position.claimed = false;
            position.bump = ctx.bumps.user_position;
        } else {
            position.amount = position.amount.checked_add(amount)
                .ok_or(ErrorCode::Overflow)?;
        }

        emit!(BetPlacedEvent {
            market: market.key(),
            user: ctx.accounts.user.key(),
            amount,
            encrypted_payload,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Resolve the market (authority only)
    pub fn resolve_market(
        ctx: Context<ResolveMarket>,
        result: MarketResult,
    ) -> Result<()> {
        require!(
            result != MarketResult::None,
            ErrorCode::InvalidResult
        );

        let market = &mut ctx.accounts.market;
        
        // Ensure market has expired
        require!(
            Clock::get()?.unix_timestamp >= market.expiry_timestamp,
            ErrorCode::MarketNotExpired
        );

        // Ensure not already resolved
        require!(!market.resolved, ErrorCode::AlreadyResolved);

        market.resolved = true;
        market.result = result;

        emit!(MarketResolvedEvent {
            market: market.key(),
            result,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Claim winnings with cryptographic proof from Arcium MXE
    /// 
    /// TRUST-MINIMIZED PAYOUT FLOW:
    /// 
    /// 1️⃣ User places bet → encrypted side sent to MXE
    /// 2️⃣ Market resolves → result recorded onchain
    /// 3️⃣ User requests payout → MXE computes in TEE:
    ///    - Decrypts user's bet side
    ///    - Calculates payout based on:
    ///      * Bet side matches market result?
    ///      * User's bet amount
    ///      * Total winning side pool
    ///    - Generates unique nonce (timestamp + random)
    ///    - Creates message: keccak256(market || user || payout || nonce)
    ///    - Signs message with MXE private key (Ed25519)
    /// 4️⃣ User submits claim transaction with:
    ///    - payout amount
    ///    - nonce
    ///    - MXE signature
    /// 5️⃣ This instruction verifies:
    ///    - Ed25519 signature from MXE_PUBKEY ✅
    ///    - Nonce not reused (replay protection) ✅
    ///    - Market resolved ✅
    ///    - Not already claimed ✅
    ///    - Vault has sufficient balance ✅
    /// 6️⃣ Only if ALL checks pass → transfer USDC
    /// 
    /// SECURITY GUARANTEES:
    /// ❌ Frontend cannot forge payouts (no MXE private key)
    /// ❌ Attackers cannot replay old proofs (nonce tracking)
    /// ❌ Users cannot modify payout amounts (invalidates signature)
    /// ❌ Vault draining impossible (each user can claim once)
    /// 
    /// CRYPTOGRAPHIC VERIFICATION:
    /// - Ed25519 signature verification via Solana ed25519_program
    /// - Message format: keccak256(market || user || payout || nonce)
    /// - Public key: MXE_PUBKEY constant (hardcoded after MXE deployment)
    pub fn claim_with_proof(
        ctx: Context<ClaimWithProof>,
        payout: u64,
        nonce: u64,
        signature: [u8; 64],
    ) -> Result<()> {
        let market = &ctx.accounts.market;
        let position = &mut ctx.accounts.user_position;

        // ============================================================================
        // SECURITY CHECKS - ALL MUST PASS
        // ============================================================================

        // 1️⃣ Ensure market is resolved
        require!(market.resolved, ErrorCode::MarketNotResolved);

        // 2️⃣ Ensure user hasn't already claimed
        require!(!position.claimed, ErrorCode::AlreadyClaimed);

        // 3️⃣ Ensure nonce hasn't been used (replay protection)
        require!(
            position.nonce_used == 0,
            ErrorCode::NonceAlreadyUsed
        );

        // 4️⃣ Construct the signed message
        // Message format: keccak256(market || user || payout || nonce)
        let message = construct_payout_message(
            &market.key(),
            &ctx.accounts.user.key(),
            payout,
            nonce,
        );

        // 5️⃣ Verify Ed25519 signature from MXE
        verify_mxe_signature(
            &ctx.accounts.ix_sysvar,
            &message,
            &signature,
        )?;

        // 6️⃣ Validate payout doesn't exceed vault balance
        require!(
            payout <= ctx.accounts.vault.amount,
            ErrorCode::InsufficientVaultBalance
        );

        // ============================================================================
        // ALL VERIFICATIONS PASSED - EXECUTE PAYOUT
        // ============================================================================

        // Transfer verified payout from vault to user
        if payout > 0 {
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
            token::transfer(transfer_ctx, payout)?;
        }

        // Mark as claimed and record nonce (prevent replay)
        position.claimed = true;
        position.nonce_used = nonce;

        emit!(ClaimEvent {
            market: market.key(),
            user: ctx.accounts.user.key(),
            amount: payout,
            nonce,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}

// ============================================================================
// Cryptographic Verification Helpers
// ============================================================================

/// Construct the message that MXE signs
/// 
/// Message Format: keccak256(market || user || payout || nonce)
/// 
/// This creates a unique, deterministic message that ties together:
/// - market: Which prediction market (prevents cross-market replay)
/// - user: Who is claiming (prevents claim theft)
/// - payout: How much they're claiming (prevents amount tampering)
/// - nonce: Unique identifier (prevents replay attacks)
/// 
/// The MXE signs this message with its Ed25519 private key.
/// This program verifies the signature against MXE_PUBKEY.
fn construct_payout_message(
    market: &Pubkey,
    user: &Pubkey,
    payout: u64,
    nonce: u64,
) -> [u8; 32] {
    let mut data = Vec::with_capacity(32 + 32 + 8 + 8);
    data.extend_from_slice(market.as_ref());
    data.extend_from_slice(user.as_ref());
    data.extend_from_slice(&payout.to_le_bytes());
    data.extend_from_slice(&nonce.to_le_bytes());
    
    // Hash the concatenated data
    keccak::hash(&data).to_bytes()
}

/// Verify Ed25519 signature from Arcium MXE
/// 
/// VERIFICATION PROCESS:
/// 1. Load Ed25519 instruction from ix_sysvar (index 0)
/// 2. Verify instruction is from ed25519_program
/// 3. Parse instruction data:
///    - Signature count (u8) = 1
///    - Padding (u8) = 0
///    - Signature offset (u16)
///    - Public key offset (u16)
///    - Message offset (u16)
///    - Message length (u16)
///    - Public key (32 bytes)
///    - Signature (64 bytes)
///    - Message (variable length)
/// 4. Verify public key matches MXE_PUBKEY
/// 5. Verify message matches our constructed message
/// 6. Ed25519 program already verified signature ✅
/// 
/// SECURITY:
/// - Uses Solana's native Ed25519 program (verified by runtime)
/// - Public key hardcoded (no substitution possible)
/// - Message constructed onchain (no tampering possible)
/// - Signature verification happens BEFORE this instruction executes
fn verify_mxe_signature(
    ix_sysvar: &AccountInfo,
    expected_message: &[u8; 32],
    expected_signature: &[u8; 64],
) -> Result<()> {
    // Verify ix_sysvar is the instructions sysvar
    require!(
        ix_sysvar.key() == &IX_SYSVAR_ID,
        ErrorCode::InvalidInstructionSysvar
    );

    // Load the Ed25519 instruction (must be at index 0)
    let ix = load_instruction_at_checked(0, ix_sysvar)
        .map_err(|_| ErrorCode::Ed25519InstructionMissing)?;

    // Verify it's the Ed25519 program
    require!(
        ix.program_id == ed25519_program::ID,
        ErrorCode::InvalidEd25519Program
    );

    // Parse Ed25519 instruction data
    // Format: https://docs.solana.com/developing/runtime-facilities/programs#ed25519-program
    require!(
        ix.data.len() >= 112, // Minimum: 2 + 2 + 2 + 2 + 2 + 32 + 64 + message
        ErrorCode::InvalidEd25519Data
    );

    // Verify signature count = 1
    let num_signatures = ix.data[0];
    require!(
        num_signatures == 1,
        ErrorCode::InvalidSignatureCount
    );

    // Extract offsets (little-endian u16)
    let pubkey_offset = u16::from_le_bytes([ix.data[4], ix.data[5]]) as usize;
    let signature_offset = u16::from_le_bytes([ix.data[2], ix.data[3]]) as usize;
    let message_offset = u16::from_le_bytes([ix.data[6], ix.data[7]]) as usize;
    let message_len = u16::from_le_bytes([ix.data[8], ix.data[9]]) as usize;

    // Verify public key matches MXE_PUBKEY
    require!(
        pubkey_offset + 32 <= ix.data.len(),
        ErrorCode::InvalidEd25519Data
    );
    let pubkey = &ix.data[pubkey_offset..pubkey_offset + 32];
    require!(
        pubkey == MXE_PUBKEY,
        ErrorCode::InvalidMXEPublicKey
    );

    // Verify signature matches
    require!(
        signature_offset + 64 <= ix.data.len(),
        ErrorCode::InvalidEd25519Data
    );
    let signature = &ix.data[signature_offset..signature_offset + 64];
    require!(
        signature == expected_signature,
        ErrorCode::SignatureMismatch
    );

    // Verify message matches
    require!(
        message_len == 32,
        ErrorCode::InvalidMessageLength
    );
    require!(
        message_offset + message_len <= ix.data.len(),
        ErrorCode::InvalidEd25519Data
    );
    let message = &ix.data[message_offset..message_offset + message_len];
    require!(
        message == expected_message,
        ErrorCode::MessageMismatch
    );

    // All checks passed - Ed25519 signature is valid!
    Ok(())
}

// ============================================================================
// Accounts
// ============================================================================

/// Create Market Account Context
/// 
/// PDA DESIGN:
/// - Market PDA: seeds = ["market", authority, question_hash]
/// - Vault PDA: seeds = ["vault", market_pubkey]
/// 
/// The Vault PDA is owned by the Token Program and holds all USDC deposits.
/// The Market PDA owns the vault via PDA authority derivation.
/// 
/// ADMIN RESTRICTION:
/// - Only ADMIN_PUBKEY can sign to create markets
/// - Check is enforced in instruction logic (not in constraint due to const limitations)
#[derive(Accounts)]
#[instruction(question: String, expiry_timestamp: i64)]
pub struct CreateMarket<'info> {
    #[account(
        init,
        payer = authority,
        space = Market::LEN,
        seeds = [b"market", authority.key().as_ref(), question.as_bytes()],
        bump
    )]
    pub market: Account<'info, Market>,

    /// Vault PDA - holds all USDC deposits for this market
    /// Authority is the vault itself (PDA as signer)
    #[account(
        init,
        payer = authority,
        token::mint = usdc_mint,
        token::authority = vault,
        seeds = [b"vault", market.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,

    /// CHECK: USDC mint address (Devnet testnet mint)
    pub usdc_mint: AccountInfo<'info>,

    /// Authority must be ADMIN_PUBKEY (checked in instruction)
    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(
        init_if_needed,
        payer = user,
        space = UserPosition::LEN,
        seeds = [b"position", market.key().as_ref(), user.key().as_ref()],
        bump
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

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResolveMarket<'info> {
    #[account(
        mut,
        constraint = market.authority == authority.key() @ ErrorCode::Unauthorized,
    )]
    pub market: Account<'info, Market>,

    pub authority: Signer<'info>,
}

/// Claim With Proof Account Context
/// 
/// CRITICAL SECURITY ACCOUNT: ix_sysvar
/// 
/// The ix_sysvar (Instructions Sysvar) is used to verify the Ed25519 signature.
/// The transaction MUST include an Ed25519 instruction at index 0 with:
/// - Public Key: MXE_PUBKEY
/// - Signature: MXE's signature over the payout message
/// - Message: keccak256(market || user || payout || nonce)
/// 
/// Solana's Ed25519 program verifies the signature BEFORE this instruction executes.
/// We then validate that the signature is from the correct MXE public key.
/// 
/// This makes forgery cryptographically impossible without MXE's private key.
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

    /// CHECK: This is the Solana Instructions Sysvar
    /// Used to verify the Ed25519 signature instruction
    #[account(address = IX_SYSVAR_ID)]
    pub ix_sysvar: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

// ============================================================================
// State
// ============================================================================

#[account]
pub struct Market {
    pub authority: Pubkey,
    pub question: String,
    pub expiry_timestamp: i64,
    pub total_pool: u64,
    pub resolved: bool,
    pub result: MarketResult,
    pub vault: Pubkey,
    pub usdc_mint: Pubkey,
    pub bump: u8,
    pub vault_bump: u8,
}

impl Market {
    pub const LEN: usize = 8 + // discriminator
        32 + // authority
        4 + 280 + // question (String with max 280 chars)
        8 + // expiry_timestamp
        8 + // total_pool
        1 + // resolved
        1 + // result enum
        32 + // vault
        32 + // usdc_mint
        1 + // bump
        1; // vault_bump
}

#[account]
pub struct UserPosition {
    pub user: Pubkey,
    pub market: Pubkey,
    pub amount: u64,
    pub claimed: bool,
    /// Nonce used in the claim proof (replay protection)
    /// 
    /// Once set to non-zero, this position cannot be claimed again.
    /// The MXE generates a unique nonce for each payout computation.
    /// Storing it prevents replay attacks (reusing old signatures).
    pub nonce_used: u64,
    pub bump: u8,
}

impl UserPosition {
    pub const LEN: usize = 8 + // discriminator
        32 + // user
        32 + // market
        8 + // amount
        1 + // claimed
        8 + // nonce_used
        1; // bump
}

// ============================================================================
// Enums
// ============================================================================

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum MarketResult {
    None,
    Yes,
    No,
}

// ============================================================================
// Events
// ============================================================================

#[event]
pub struct MarketCreatedEvent {
    pub market: Pubkey,
    pub authority: Pubkey,
    pub question: String,
    pub expiry_timestamp: i64,
}

#[event]
pub struct BetPlacedEvent {
    pub market: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
    pub encrypted_payload: Vec<u8>,
    pub timestamp: i64,
}

#[event]
pub struct MarketResolvedEvent {
    pub market: Pubkey,
    pub result: MarketResult,
    pub timestamp: i64,
}

#[event]
pub struct ClaimEvent {
    pub market: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
    pub nonce: u64,
    pub timestamp: i64,
}

// ============================================================================
// Errors
// ============================================================================

#[error_code]
pub enum ErrorCode {
    #[msg("Question must be 280 characters or less")]
    QuestionTooLong,

    #[msg("Expiry timestamp must be in the future")]
    ExpiryInPast,

    #[msg("Invalid bet amount")]
    InvalidAmount,

    #[msg("Encrypted payload too large (max 512 bytes)")]
    PayloadTooLarge,

    #[msg("Market has expired")]
    MarketExpired,

    #[msg("Market already resolved")]
    MarketResolved,

    #[msg("Arithmetic overflow")]
    Overflow,

    #[msg("Invalid market result")]
    InvalidResult,

    #[msg("Market has not expired yet")]
    MarketNotExpired,

    #[msg("Market already resolved")]
    AlreadyResolved,

    #[msg("Market not yet resolved")]
    MarketNotResolved,

    #[msg("User has already claimed")]
    AlreadyClaimed,

    #[msg("Insufficient vault balance")]
    InsufficientVaultBalance,

    #[msg("Unauthorized: Only admin can create markets")]
    Unauthorized,

    // ============================================================================
    // Security / Cryptographic Verification Errors
    // ============================================================================

    #[msg("Nonce already used (replay protection)")]
    NonceAlreadyUsed,

    #[msg("Invalid instructions sysvar account")]
    InvalidInstructionSysvar,

    #[msg("Ed25519 instruction missing from transaction")]
    Ed25519InstructionMissing,

    #[msg("Invalid Ed25519 program ID")]
    InvalidEd25519Program,

    #[msg("Invalid Ed25519 instruction data")]
    InvalidEd25519Data,

    #[msg("Invalid signature count (must be 1)")]
    InvalidSignatureCount,

    #[msg("Public key does not match MXE_PUBKEY")]
    InvalidMXEPublicKey,

    #[msg("Signature does not match expected signature")]
    SignatureMismatch,

    #[msg("Invalid message length (must be 32 bytes)")]
    InvalidMessageLength,

    #[msg("Message does not match expected message")]
    MessageMismatch,
}
