import { createContext, FC, ReactNode, useContext, useMemo } from 'react';
import { useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider, Idl, BN } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import idlJson from '../idl/nexora.json';
import { ArciumMockClient } from '../lib/arcium-mock';

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
  arciumClient: ArciumMockClient;
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
  arciumClient: new ArciumMockClient(),
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

  const arciumClient = useMemo(() => new ArciumMockClient(), []);

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
    if (!program || !wallet) throw new Error('Wallet not connected');

    // Create encrypted payload
    const payload = {
      user: wallet.publicKey.toString(),
      market: market.toString(),
      side,
      amount: amount.toString(),
      timestamp: Date.now(),
    };

    const encryptedPayload = await arciumClient.encrypt(JSON.stringify(payload));

    // Get user's token account
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

    // Record bet in mock Arcium
    await arciumClient.recordBet(
      market.toString(),
      wallet.publicKey.toString(),
      side,
      amount.toNumber()
    );

    return tx;
  };

  const resolveMarket = async (
    market: PublicKey,
    result: 'yes' | 'no'
  ): Promise<string> => {
    if (!program || !wallet) throw new Error('Wallet not connected');

    const resultEnum = result === 'yes' ? { yes: {} } : { no: {} };

    const tx = await program.methods
      .resolveMarket(resultEnum)
      .accounts({
        market,
        authority: wallet.publicKey,
      })
      .rpc();

    // Compute payouts in mock Arcium
    const marketAccount = await program.account.market.fetch(market);
    await arciumClient.computePayouts(
      market.toString(),
      result,
      (marketAccount.totalPool as BN).toNumber()
    );

    return tx;
  };

  const claimPayout = async (market: PublicKey): Promise<string> => {
    if (!program || !wallet) throw new Error('Wallet not connected');

    // Query payout from Arcium
    const payoutAmount = await arciumClient.getUserPayout(
      market.toString(),
      wallet.publicKey.toString()
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

    const userTokenAccount = await getAssociatedTokenAddress(
      USDC_MINT,
      wallet.publicKey
    );

    const tx = await program.methods
      .claim(new BN(payoutAmount))
      .accounts({
        market,
        userPosition: userPositionPda,
        vault: vaultPda,
        userTokenAccount,
        user: wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

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
