import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Nexora } from "../target/types/nexora";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { assert } from "chai";

describe("nexora", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Nexora as Program<Nexora>;
  const authority = provider.wallet;

  let usdcMint: PublicKey;
  let authorityTokenAccount: PublicKey;
  let userWallet: anchor.web3.Keypair;
  let userTokenAccount: PublicKey;

  before(async () => {
    // Create USDC-like token
    usdcMint = await createMint(
      provider.connection,
      authority.payer,
      authority.publicKey,
      null,
      6 // USDC has 6 decimals
    );

    console.log("USDC Mint:", usdcMint.toString());

    // Create token account for authority
    const authorityATA = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      authority.payer,
      usdcMint,
      authority.publicKey
    );
    authorityTokenAccount = authorityATA.address;

    // Mint 1000 USDC to authority
    await mintTo(
      provider.connection,
      authority.payer,
      usdcMint,
      authorityTokenAccount,
      authority.publicKey,
      1000 * 1e6
    );

    // Create user wallet
    userWallet = anchor.web3.Keypair.generate();

    // Airdrop SOL to user
    const airdropSig = await provider.connection.requestAirdrop(
      userWallet.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig);

    // Create token account for user
    const userATA = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      authority.payer,
      usdcMint,
      userWallet.publicKey
    );
    userTokenAccount = userATA.address;

    // Mint 100 USDC to user
    await mintTo(
      provider.connection,
      authority.payer,
      usdcMint,
      userTokenAccount,
      authority.publicKey,
      100 * 1e6
    );

    console.log("Authority Token Account:", authorityTokenAccount.toString());
    console.log("User Wallet:", userWallet.publicKey.toString());
    console.log("User Token Account:", userTokenAccount.toString());
  });

  it("Creates a market", async () => {
    const question = "Will Bitcoin reach $100k by end of 2026?";
    const expiryTimestamp = new BN(Math.floor(Date.now() / 1000) + 86400); // 24 hours

    const [marketPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("market"),
        authority.publicKey.toBuffer(),
        Buffer.from(question),
      ],
      program.programId
    );

    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), marketPda.toBuffer()],
      program.programId
    );

    await program.methods
      .createMarket(question, expiryTimestamp)
      .accounts({
        market: marketPda,
        vault: vaultPda,
        usdcMint,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    const marketAccount = await program.account.market.fetch(marketPda);
    
    assert.equal(marketAccount.question, question);
    assert.equal(marketAccount.authority.toString(), authority.publicKey.toString());
    assert.equal(marketAccount.totalPool.toNumber(), 0);
    assert.equal(marketAccount.resolved, false);

    console.log("✅ Market created:", marketPda.toString());
  });

  it("Places a bet", async () => {
    const question = "Will Bitcoin reach $100k by end of 2026?";
    const expiryTimestamp = new BN(Math.floor(Date.now() / 1000) + 86400);

    const [marketPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("market"),
        authority.publicKey.toBuffer(),
        Buffer.from(question),
      ],
      program.programId
    );

    const [userPositionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("position"),
        marketPda.toBuffer(),
        userWallet.publicKey.toBuffer(),
      ],
      program.programId
    );

    const marketAccount = await program.account.market.fetch(marketPda);
    const vaultPda = marketAccount.vault;

    // Create encrypted payload (mock)
    const payload = {
      user: userWallet.publicKey.toString(),
      market: marketPda.toString(),
      side: "yes",
      amount: "5000000", // 5 USDC
      timestamp: Date.now(),
    };
    const encryptedPayload = Buffer.from(
      btoa(JSON.stringify(payload)),
      "utf-8"
    );

    const betAmount = new BN(5 * 1e6); // 5 USDC

    await program.methods
      .placeBet(Array.from(encryptedPayload), betAmount)
      .accounts({
        market: marketPda,
        userPosition: userPositionPda,
        vault: vaultPda,
        userTokenAccount,
        user: userWallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([userWallet])
      .rpc();

    const updatedMarket = await program.account.market.fetch(marketPda);
    assert.equal(updatedMarket.totalPool.toNumber(), 5 * 1e6);

    const position = await program.account.userPosition.fetch(userPositionPda);
    assert.equal(position.amount.toNumber(), 5 * 1e6);
    assert.equal(position.claimed, false);

    console.log("✅ Bet placed successfully");
  });

  it("Resolves market (after expiry)", async () => {
    const question = "Will Ethereum stay above $3k?";
    const expiryTimestamp = new BN(Math.floor(Date.now() / 1000) + 2); // 2 seconds

    const [marketPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("market"),
        authority.publicKey.toBuffer(),
        Buffer.from(question),
      ],
      program.programId
    );

    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), marketPda.toBuffer()],
      program.programId
    );

    // Create market
    await program.methods
      .createMarket(question, expiryTimestamp)
      .accounts({
        market: marketPda,
        vault: vaultPda,
        usdcMint,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    // Wait for expiry
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Resolve as YES
    await program.methods
      .resolveMarket({ yes: {} })
      .accounts({
        market: marketPda,
        authority: authority.publicKey,
      })
      .rpc();

    const marketAccount = await program.account.market.fetch(marketPda);
    assert.equal(marketAccount.resolved, true);
    assert.ok("yes" in marketAccount.result);

    console.log("✅ Market resolved successfully");
  });

  it("Claims payout", async () => {
    const question = "Will Solana hit $500?";
    const expiryTimestamp = new BN(Math.floor(Date.now() / 1000) + 2);

    const [marketPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("market"),
        authority.publicKey.toBuffer(),
        Buffer.from(question),
      ],
      program.programId
    );

    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), marketPda.toBuffer()],
      program.programId
    );

    const [userPositionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("position"),
        marketPda.toBuffer(),
        userWallet.publicKey.toBuffer(),
      ],
      program.programId
    );

    // Create market
    await program.methods
      .createMarket(question, expiryTimestamp)
      .accounts({
        market: marketPda,
        vault: vaultPda,
        usdcMint,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    // Place bet
    const payload = {
      user: userWallet.publicKey.toString(),
      market: marketPda.toString(),
      side: "yes",
      amount: "10000000",
      timestamp: Date.now(),
    };
    const encryptedPayload = Buffer.from(
      btoa(JSON.stringify(payload)),
      "utf-8"
    );

    await program.methods
      .placeBet(Array.from(encryptedPayload), new BN(10 * 1e6))
      .accounts({
        market: marketPda,
        userPosition: userPositionPda,
        vault: vaultPda,
        userTokenAccount,
        user: userWallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([userWallet])
      .rpc();

    // Wait for expiry
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Resolve
    await program.methods
      .resolveMarket({ yes: {} })
      .accounts({
        market: marketPda,
        authority: authority.publicKey,
      })
      .rpc();

    // Get user balance before
    const userBalanceBefore = await provider.connection.getTokenAccountBalance(
      userTokenAccount
    );

    // Claim (user won, so they get their 10 USDC back as only winner)
    await program.methods
      .claim(new BN(10 * 1e6)) // Full pool payout
      .accounts({
        market: marketPda,
        userPosition: userPositionPda,
        vault: vaultPda,
        userTokenAccount,
        user: userWallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([userWallet])
      .rpc();

    // Check balance increased
    const userBalanceAfter = await provider.connection.getTokenAccountBalance(
      userTokenAccount
    );

    const balanceIncrease =
      parseInt(userBalanceAfter.value.amount) -
      parseInt(userBalanceBefore.value.amount);
    assert.equal(balanceIncrease, 10 * 1e6);

    // Check position marked as claimed
    const position = await program.account.userPosition.fetch(userPositionPda);
    assert.equal(position.claimed, true);

    console.log("✅ Payout claimed successfully");
  });
});
