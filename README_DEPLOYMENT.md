# NEXORA - Private Prediction Markets on Solana

A fully functional confidential prediction market protocol built on Solana Devnet with Arcium MXE integration for private bet handling.

## 🚀 Features

- **Real Wallet Integration**: Phantom wallet support
- **SPL Token Handling**: Real USDC on Devnet
- **Onchain Anchor Program**: Production-ready Rust smart contract
- **Confidential Betting**: Arcium MXE encrypted bet logic
- **Full Lifecycle**: Create → Bet → Resolve → Claim

## 📁 Project Structure

```
nexora/
├── programs/
│   └── nexora/
│       ├── src/
│       │   └── lib.rs          # Anchor program (Rust)
│       └── Cargo.toml
├── app/
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── contexts/           # Nexora context + Anchor integration
│   │   ├── lib/                # Arcium mock client
│   │   ├── idl/                # Program IDL
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── tests/
│   └── nexora.ts               # Anchor tests
├── Anchor.toml
├── ARCIUM_INTEGRATION.md       # Arcium MXE documentation
└── README.md
```

## 🛠️ Tech Stack

### Backend
- **Solana Devnet**
- **Anchor Framework** (v0.29.0)
- **Rust** (stable)
- **SPL Token** (USDC)

### Frontend
- **Vite + React + TypeScript**
- **@solana/web3.js**
- **@coral-xyz/anchor**
- **@solana/wallet-adapter** (Phantom)
- **TailwindCSS**

### Confidential Layer
- **Arcium MXE** (mock for devnet)

## 📋 Prerequisites

1. **Rust & Cargo**
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   rustup default stable
   ```

2. **Solana CLI**
   ```bash
   sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
   solana --version
   ```

3. **Anchor CLI**
   ```bash
   cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
   avm install 0.29.0
   avm use 0.29.0
   anchor --version
   ```

4. **Node.js & Yarn**
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   nvm install 18
   npm install -g yarn
   ```

5. **Phantom Wallet**
   - Install [Phantom browser extension](https://phantom.app/)

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone <your-repo>
cd nexora

# Install program dependencies
anchor build

# Install frontend dependencies
cd app
yarn install
```

### 2. Configure Solana for Devnet

```bash
# Set config to devnet
solana config set --url https://api.devnet.solana.com

# Create keypair (if you don't have one)
solana-keygen new -o ~/.config/solana/id.json

# Airdrop SOL for deployment
solana airdrop 2
solana balance
```

### 3. Create or Use USDC Devnet Mint

#### Option A: Use Official USDC Devnet Mint
```bash
# Official devnet USDC mint (if available)
# Update USDC_MINT in app/src/contexts/NexoraContext.tsx
```

#### Option B: Create Your Own Test Token
```bash
# Install spl-token CLI
cargo install spl-token-cli

# Create a new token (this will be your "USDC")
spl-token create-token --decimals 6
# Copy the token mint address

# Create an associated token account
spl-token create-account <TOKEN_MINT>

# Mint some tokens to yourself
spl-token mint <TOKEN_MINT> 1000

# Update USDC_MINT in:
# - app/src/contexts/NexoraContext.tsx
```

### 4. Build & Deploy Anchor Program

```bash
# Build the program
anchor build

# Get program ID
solana address -k target/deploy/nexora-keypair.json

# Update program ID in:
# - Anchor.toml (under [programs.devnet])
# - programs/nexora/src/lib.rs (declare_id!)
# - app/src/contexts/NexoraContext.tsx (PROGRAM_ID)

# Rebuild after updating IDs
anchor build

# Deploy to devnet
anchor deploy

# Verify deployment
solana program show <PROGRAM_ID>
```

### 5. Generate IDL and Copy to Frontend

```bash
# IDL is generated during build at target/idl/nexora.json
cp target/idl/nexora.json app/src/idl/nexora.json
```

### 6. Run Frontend

```bash
cd app
yarn dev
```

Open http://localhost:5173

## 🧪 Testing

### Run Anchor Tests

```bash
anchor test
```

### Manual Testing Checklist

#### 1. **Connect Wallet**
- [ ] Open app in browser
- [ ] Click "Select Wallet"
- [ ] Connect Phantom
- [ ] Verify wallet address shows in header

#### 2. **Airdrop Devnet USDC**
```bash
# Get your wallet address from Phantom
# Create associated token account for your wallet
spl-token create-account <USDC_MINT> --owner <YOUR_WALLET>

# Mint USDC to your wallet
spl-token mint <USDC_MINT> 100 <YOUR_TOKEN_ACCOUNT>

# Check balance
spl-token balance <USDC_MINT>
```

#### 3. **Create Market**
- [ ] Click "Create Market"
- [ ] Enter question (e.g., "Will BTC reach $100k by EOY?")
- [ ] Set duration (e.g., 24 hours)
- [ ] Click "Create Market"
- [ ] Approve transaction in Phantom
- [ ] Verify market appears in list

#### 4. **Place Bet**
- [ ] Click "Place Bet" on a market
- [ ] Choose side (YES or NO)
- [ ] Enter amount (e.g., 5 USDC)
- [ ] Click "Bet"
- [ ] Approve USDC transfer in Phantom
- [ ] Verify bet transaction succeeds
- [ ] Check that total pool increased
- [ ] Verify "Your Position" shows in market card

#### 5. **Resolve Market** (as Authority)
- [ ] Wait for market to expire (or modify timestamp for testing)
- [ ] Click "✅ YES" or "❌ NO" as authority
- [ ] Approve transaction
- [ ] Verify market shows as resolved
- [ ] Check console logs for Arcium payout computation

#### 6. **Claim Payout**
- [ ] Click "💰 Claim Payout" after resolution
- [ ] Approve transaction
- [ ] Verify USDC received in wallet
- [ ] Verify "Already Claimed" shows

## 🔧 Configuration

### Update Program ID

After first build:

1. Get program ID:
   ```bash
   solana address -k target/deploy/nexora-keypair.json
   ```

2. Update in:
   - `Anchor.toml`: `nexora = "<YOUR_PROGRAM_ID>"`
   - `programs/nexora/src/lib.rs`: `declare_id!("<YOUR_PROGRAM_ID>")`
   - `app/src/contexts/NexoraContext.tsx`: `PROGRAM_ID = new PublicKey("<YOUR_PROGRAM_ID>")`

3. Rebuild:
   ```bash
   anchor build
   anchor deploy
   ```

### Update USDC Mint

Update in `app/src/contexts/NexoraContext.tsx`:
```typescript
export const USDC_MINT = new PublicKey('<YOUR_USDC_MINT>');
```

## 📊 Program Instructions

### `create_market`
- **Authority**: Any user
- **Accounts**: Market PDA, Vault PDA, USDC mint
- **Args**: `question: string`, `expiry_timestamp: i64`
- **Creates**: Market account and vault token account

### `place_bet`
- **Authority**: Any user
- **Accounts**: Market, User Position PDA, Vault, User token account
- **Args**: `encrypted_payload: Vec<u8>`, `amount: u64`
- **Transfers**: USDC from user to vault
- **Emits**: `BetPlacedEvent` with encrypted payload

### `resolve_market`
- **Authority**: Market creator only
- **Accounts**: Market
- **Args**: `result: MarketResult` (Yes or No)
- **Requires**: Market expired
- **Triggers**: Arcium payout computation

### `claim`
- **Authority**: Any user with position
- **Accounts**: Market, User Position PDA, Vault, User token account
- **Args**: `payout_amount: u64` (from Arcium)
- **Transfers**: USDC from vault to user
- **Prevents**: Double claiming

## 🔒 Security Features

- ✅ PDA-based vaults (no external authority)
- ✅ Timestamp validation (prevent late bets)
- ✅ Double-claim prevention
- ✅ Authority-only resolution
- ✅ Overflow checks
- ✅ ATA and mint validation

## 🌐 Arcium Integration

See [ARCIUM_INTEGRATION.md](./ARCIUM_INTEGRATION.md) for detailed documentation on:
- Encrypted payload structure
- MXE state management
- Payout computation logic
- Production deployment steps

Currently uses **ArciumMockClient** for devnet testing. Replace with real Arcium SDK for mainnet.

## 🐛 Troubleshooting

### "Account does not exist"
- Ensure program is deployed: `solana program show <PROGRAM_ID>`
- Verify correct network: `solana config get`

### "Insufficient funds"
- Airdrop more SOL: `solana airdrop 2`
- Mint more USDC: `spl-token mint <MINT> 100`

### "Transaction simulation failed"
- Check console logs for error details
- Verify token accounts exist
- Ensure wallet has USDC and SOL

### Phantom not connecting
- Refresh page
- Switch Phantom to Devnet in settings
- Clear browser cache

## 📝 Next Steps for Production

1. **Deploy Real Arcium MXE**
   - Replace `ArciumMockClient` with Arcium SDK
   - Configure TEE endpoints
   - Set up event indexers

2. **Add Payout Verification**
   - Integrate Arcium signature verification in `claim` instruction
   - Prevent unauthorized payout claims

3. **UI Enhancements**
   - Real-time updates via WebSocket
   - Market search and filters
   - Historical data and charts

4. **Security Audit**
   - Third-party smart contract audit
   - Penetration testing
   - Arcium MXE security review

## 📄 License

MIT

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open pull request

## 📞 Support

For issues and questions:
- GitHub Issues
- [Anchor Discord](https://discord.gg/anchorlang)
- [Solana Discord](https://discord.gg/solana)
- [Arcium Discord](https://discord.gg/arcium)

---

**Built with ❤️ for the Solana ecosystem**
