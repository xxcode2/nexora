# NEXORA - Quick Reference Card

## 🚀 Deployment Quick Commands

### First Time Setup
```bash
# Configure Solana
solana config set --url https://api.devnet.solana.com
solana airdrop 2

# Build & Get Program ID
anchor build
solana address -k target/deploy/nexora-keypair.json

# Deploy
anchor deploy

# Create Test USDC
spl-token create-token --decimals 6
spl-token create-account <MINT>
spl-token mint <MINT> 1000
```

### Must Update After First Build
1. **Anchor.toml** → `programs.devnet.nexora = "<PROGRAM_ID>"`
2. **programs/nexora/src/lib.rs** → `declare_id!("<PROGRAM_ID>")`
3. **app/src/contexts/NexoraContext.tsx** → `PROGRAM_ID = new PublicKey("<PROGRAM_ID>")`
4. **app/src/contexts/NexoraContext.tsx** → `USDC_MINT = new PublicKey("<USDC_MINT>")`

Then rebuild:
```bash
anchor build && anchor deploy
```

---

## 🧪 Testing Quick Commands

```bash
# Run Anchor tests
anchor test

# Check program
solana program show <PROGRAM_ID>

# Check token balance
spl-token balance <USDC_MINT>

# Watch logs
solana logs <PROGRAM_ID>
```

---

## 🎨 Frontend Quick Commands

```bash
cd app
yarn install
yarn dev                    # Dev server
yarn build                  # Production build
```

---

## 💰 Token Management

```bash
# Create token (USDC-like)
spl-token create-token --decimals 6

# Create account for wallet
spl-token create-account <MINT> --owner <WALLET>

# Mint tokens
spl-token mint <MINT> <AMOUNT>

# Check balance
spl-token balance <MINT>

# Get token account address
spl-token address --token <MINT> --owner <WALLET>
```

---

## 🔧 Troubleshooting

### "Account does not exist"
```bash
# Verify program deployed
solana program show <PROGRAM_ID>
```

### "Insufficient funds"
```bash
# Airdrop SOL
solana airdrop 2

# Mint more USDC
spl-token mint <MINT> 100
```

### "Program ID mismatch"
1. Check all 3 locations have same ID
2. Rebuild: `anchor build`
3. Redeploy: `anchor deploy`

### Phantom wallet issues
- Switch to Devnet in Phantom settings
- Refresh the page
- Disconnect and reconnect

---

## 📊 Account Structure Quick Ref

### Market PDA
```
seeds: ["market", authority, question]
```

### Vault PDA
```
seeds: ["vault", market]
```

### User Position PDA
```
seeds: ["position", market, user]
```

---

## 🔐 Key Security Points

✅ Vault is PDA (no external authority)  
✅ Only authority can resolve  
✅ Cannot bet after expiry  
✅ Cannot claim twice  
✅ Overflow protection enabled

---

## 📝 Commit Message Convention

```
feat: add new feature
fix: bug fix
docs: documentation
test: testing
refactor: code restructure
```

---

## 🎯 Testing Workflow

1. ✅ Connect wallet
2. ✅ Create market
3. ✅ Place bet (YES)
4. ✅ Place bet (NO) with different wallet
5. ✅ Wait for expiry
6. ✅ Resolve as authority
7. ✅ Claim payouts
8. ✅ Verify balances

---

## 📞 Important Links

- [Solana Explorer](https://explorer.solana.com/?cluster=devnet)
- [Phantom](https://phantom.app/)
- [Anchor Docs](https://book.anchor-lang.com/)
- [Solana Docs](https://docs.solana.com/)

---

## 📋 File Locations

| File | Purpose |
|------|---------|
| `programs/nexora/src/lib.rs` | Smart contract |
| `app/src/contexts/NexoraContext.tsx` | Anchor integration |
| `app/src/lib/arcium-mock.ts` | Confidential compute mock |
| `app/src/idl/nexora.json` | Program IDL |
| `tests/nexora.ts` | Test suite |

---

## 🚨 Pre-Deploy Checklist

- [ ] Program ID updated in 3 places
- [ ] USDC mint updated in NexoraContext
- [ ] anchor build completed
- [ ] anchor deploy succeeded
- [ ] IDL copied to app/src/idl/
- [ ] Frontend dependencies installed
- [ ] Phantom set to Devnet

---

**Last Updated**: Feb 2026  
**Version**: 0.1.0
