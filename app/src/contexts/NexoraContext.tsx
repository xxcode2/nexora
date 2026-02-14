import { createContext, FC, ReactNode, useContext, useMemo } from 'react';
import { useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider, Idl, BN } from '@coral-xyz/anchor';
import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import idlJson from '../idl/nexora.json';
import {
  NexoraArciumClient,
  DEFAULT_ARCIUM_CONFIG,
} from '../lib/nexora-arcium';

// Program ID from Anchor.toml
const PROGRAM_ID = new PublicKey('Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS');

// Helper function to create a 32-byte hash from a string
const hashString = async (str: string): Promise<Uint8Array> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hashBuffer);
};

// USDC Devnet mint (use official or create your own)
export const USDC_MINT = new PublicKey('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr');

// Admin pubkey - ONLY this wallet can create markets on Devnet V1
export const ADMIN_PUBKEY = new PublicKey('GveKcrXTsLd2nqSPgwV1BifPS1fJvoaP5AajpAXitxez');

export interface Market {
  publicKey: PublicKey;
  authority: PublicKey;
  question: string;
  expiryTimestamp: BN;
  totalPool: BN;
  resolved: boolean;
  result: { none: {} } | { yes: {} } | { no: {} };
  vault: PublicKey;
  usdcMint: PublicKey;
}

export interface UserPosition {
  publicKey: PublicKey;
  user: PublicKey;
  market: PublicKey;
  amount: BN;
  claimed: boolean;
}

interface NexoraContextType {
  program: Program | null;
  arciumClient: NexoraArciumClient | null;
  createMarket: (question: string, expiryTimestamp: number) => Promise<string>;
  placeBet: (market: PublicKey, side: 'yes' | 'no', amount: BN) => Promise<string>;
  resolveMarket: (market: PublicKey, result: 'yes' | 'no') => Promise<string>;
  claimPayout: (market: PublicKey) => Promise<string>;
  fetchMarkets: () => Promise<Market[]>;
  fetchUserPosition: (market: PublicKey, user: PublicKey) => Promise<UserPosition | null>;
  fetchUserPositions: (user: PublicKey) => Promise<UserPosition[]>;
}

const NexoraContext = createContext<NexoraContextType>({
  program: null,
  arciumClient: null,
  createMarket: async () => '',
  placeBet: async () => '',
  resolveMarket: async () => '',
  claimPayout: async () => '',
  fetchMarkets: async () => [],
  fetchUserPosition: async () => null,
  fetchUserPositions: async () => [],
});

export const useNexora = () => useContext(NexoraContext);

interface NexoraProviderProps {
  children: ReactNode;
}

export const NexoraProvider: FC<NexoraProviderProps> = ({ children }) => {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const program = useMemo(() => {
    if (!wallet) return null;

    const provider = new AnchorProvider(
      connection,
      wallet,
      AnchorProvider.defaultOptions()
    );

    return new Program(idlJson as Idl, PROGRAM_ID, provider);
  }, [connection, wallet]);

  const arciumClient = useMemo(
    () =>
      new NexoraArciumClient(
        DEFAULT_ARCIUM_CONFIG.apiEndpoint,
        DEFAULT_ARCIUM_CONFIG.mxePublicKey
      ),
    []
  );

  const createMarket = async (
    question: string,
    expiryTimestamp: number
  ): Promise<string> => {
    if (!program || !wallet) throw new Error('Wallet not connected');

    // Hash the question to ensure seed length <= 32 bytes
    const questionHash = await hashString(question);

    const [marketPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('market'),
        wallet.publicKey.toBuffer(),
        Buffer.from(questionHash),
      ],
      program.programId
    );

    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), marketPda.toBuffer()],
      program.programId
    );

    const tx = await program.methods
      .createMarket(question, new BN(expiryTimestamp))
      .accounts({
        market: marketPda,
        vault: vaultPda,
        usdcMint: USDC_MINT,
        authority: wallet.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    return tx;
  };

  const placeBet = async (
    market: PublicKey,
    side: 'yes' | 'no',
    amount: BN
  ): Promise<string> => {
    if (!program || !wallet || !arciumClient) throw new Error('Wallet not connected');

    // ============================================================================
    // STEP 1: Prepare onchain transaction
    // ============================================================================
    const userTokenAccount = await getAssociatedTokenAddress(
      USDC_MINT,
      wallet.publicKey
    );

    const [userPositionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('position'),
        market.toBuffer(),
        wallet.publicKey.toBuffer(),
      ],
      program.programId
    );

    const marketAccount = await program.account.market.fetch(market);
    const vaultPda = marketAccount.vault as PublicKey;

    // Encrypt bet payload with zero placeholder (real encryption happens in MXE)
    // Frontend just submits market + user + amount for onchain record
    const encryptedPayload = new Uint8Array(81);

    // Submit onchain transaction
    const tx = await program.methods
      .placeBet(Array.from(encryptedPayload), amount)
      .accounts({
        market,
        userPosition: userPositionPda,
        vault: vaultPda,
        userTokenAccount,
        user: wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // ============================================================================
    // STEP 2: Submit to Arcium MXE for confidential computation
    // ============================================================================
    // This happens asynchronously - MXE will store encrypted bet and track totals
    // Frontend stores computationId for later retrieval of signed payout claim
    const computationId = await arciumClient.submitBetComputation(
      market,
      wallet.publicKey,
      side,
      amount.toNumber()
    );

    // Store computationId in localStorage for recovery
    const storageKey = `computation:${market.toBase58()}:${wallet.publicKey.toBase58()}`;
    localStorage.setItem(storageKey, computationId);

    console.log('✅ Bet placed and submitted to MXE', {
      market: market.toBase58(),
      side,
      amount: amount.toNumber(),
      computationId,
      txId: tx,
    });

    return tx;
  };

  const resolveMarket = async (
    market: PublicKey,
    result: 'yes' | 'no'
  ): Promise<string> => {
    if (!program || !wallet || !arciumClient)
      throw new Error('Wallet not connected');

    // ============================================================================
    // STEP 1: Update market state onchain
    // ============================================================================
    const resultEnum = result === 'yes' ? { yes: {} } : { no: {} };

    const tx = await program.methods
      .resolveMarket(resultEnum)
      .accounts({
        market,
        authority: wallet.publicKey,
      })
      .rpc();

    // ============================================================================
    // STEP 2: Trigger payout computation in Arcium MXE
    // ============================================================================
    // MXE will compute individual payouts for all bettors based on resolution
    const marketAccount = await program.account.market.fetch(market);
    const totalPool = (marketAccount.totalPool as BN).toNumber();

    const payoutComputationId = await arciumClient.triggerPayoutComputation(
      market,
      result,
      totalPool
    );

    // Store for recovery
    const storageKey = `payout_computation:${market.toBase58()}`;
    localStorage.setItem(storageKey, payoutComputationId);

    console.log('✅ Market resolved and payout computation triggered', {
      market: market.toBase58(),
      result,
      totalPool,
      payoutComputationId,
      txId: tx,
    });

    return tx;
  };

  const claimPayout = async (market: PublicKey): Promise<string> => {
    if (!program || !wallet || !arciumClient)
      throw new Error('Wallet not connected');

    // ============================================================================
    // STEP 1: Retrieve signed payout claim from Arcium MXE
    // ============================================================================
    // MXE returns: payout amount, nonce (for replay protection), Ed25519 signature
    // Signature: Ed25519(Keccak256(market || user || payout || nonce))
    const { payout, nonce, signature } =
      await arciumClient.getPayoutClaim(market, wallet.publicKey);

    console.log('📋 Retrieved payout claim from MXE', {
      market: market.toBase58(),
      user: wallet.publicKey.toBase58(),
      payout,
      nonce,
      signatureLength: signature.length,
    });

    // ============================================================================
    // STEP 2: Prepare onchain proof verification accounts
    // ============================================================================
    const [userPositionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('position'),
        market.toBuffer(),
        wallet.publicKey.toBuffer(),
      ],
      program.programId
    );

    const marketAccount = await program.account.market.fetch(market);
    const vaultPda = marketAccount.vault as PublicKey;

    const userTokenAccount = await getAssociatedTokenAddress(
      USDC_MINT,
      wallet.publicKey
    );

    // ============================================================================
    // STEP 3: Call claim_with_proof instruction
    // ============================================================================
    // The onchain program will:
    // 1. Construct message: Keccak256(market || user || payout || nonce)
    // 2. Load the Ed25519 signature instruction from sysvar
    // 3. Verify signature matches MXE_PUBKEY
    // 4. Verify message matches constructed payout data
    // 5. Verify nonce hasn't been used (replay protection)
    // 6. Transfer payout from vault to user if all checks pass

    const tx = await program.methods
      .claimWithProof(new BN(payout), new BN(nonce), Array.from(signature))
      .accounts({
        market,
        userPosition: userPositionPda,
        vault: vaultPda,
        userTokenAccount,
        user: wallet.publicKey,
        ixSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log('✅ Payout claimed with signature verification', {
      market: market.toBase58(),
      user: wallet.publicKey.toBase58(),
      payout,
      txId: tx,
    });

    return tx;
  };

  const fetchMarkets = async (): Promise<Market[]> => {
    if (!program) return [];

    const accounts = await program.account.market.all();
    return accounts.map((acc: any) => ({
      publicKey: acc.publicKey,
      ...acc.account,
    })) as Market[];
  };

  const fetchUserPosition = async (
    market: PublicKey,
    user: PublicKey
  ): Promise<UserPosition | null> => {
    if (!program) return null;

    const [userPositionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('position'), market.toBuffer(), user.toBuffer()],
      program.programId
    );

    try {
      const position = await program.account.userPosition.fetch(userPositionPda);
      return {
        publicKey: userPositionPda,
        ...position,
      } as UserPosition;
    } catch {
      return null;
    }
  };

  const fetchUserPositions = async (user: PublicKey): Promise<UserPosition[]> => {
    if (!program) return [];

    const accounts = await program.account.userPosition.all([
      {
        memcmp: {
          offset: 8, // After discriminator
          bytes: user.toBase58(),
        },
      },
    ]);

    return accounts.map((acc: any) => ({
      publicKey: acc.publicKey,
      ...acc.account,
    })) as UserPosition[];
  };

  const value: NexoraContextType = {
    program,
    arciumClient,
    createMarket,
    placeBet,
    resolveMarket,
    claimPayout,
    fetchMarkets,
    fetchUserPosition,
    fetchUserPositions,
  };

  return (
    <NexoraContext.Provider value={value}>
      {children}
    </NexoraContext.Provider>
  );
};
