# NEXORA DEVNET TESTING CHECKLIST

## Pre-deployment Checklist

### Environment Setup
- [ ] Solana CLI installed and configured
- [ ] Anchor CLI installed (v0.29.0)
- [ ] Node.js and Yarn installed
- [ ] Phantom wallet installed and set to Devnet
- [ ] Solana config set to devnet: `solana config get`
- [ ] SOL balance > 2: `solana balance`

### Program Configuration
- [ ] Program built: `anchor build`
- [ ] Program ID matches in:
  - [ ] `Anchor.toml`
  - [ ] `programs/nexora/src/lib.rs`
  - [ ] `app/src/contexts/NexoraContext.tsx`
- [ ] Program deployed: `anchor deploy`
- [ ] Deployment verified: `solana program show <PROGRAM_ID>`

### Token Setup
- [ ] Test USDC mint created with 6 decimals
- [ ] USDC mint address updated in `NexoraContext.tsx`
- [ ] Associated token account created for your wallet
- [ ] Test USDC minted to your account (100+)
- [ ] Token balance verified: `spl-token balance <MINT>`

### Frontend Setup
- [ ] IDL copied to `app/src/idl/nexora.json`
- [ ] Dependencies installed: `cd app && yarn install`
- [ ] Frontend starts without errors: `yarn dev`
- [ ] App accessible at http://localhost:5173

---

## Functional Testing

### 1. Wallet Connection
- [ ] Navigate to http://localhost:5173
- [ ] Click "Select Wallet" button
- [ ] Phantom appears in wallet list
- [ ] Successfully connect to Phantom
- [ ] Wallet address displays in header (shortened format)
- [ ] Disconnect and reconnect works
- [ ] "Devnet" badge visible

**Expected Result**: Wallet connected, address visible

---

### 2. Create Market (Happy Path)

#### Test Case 2.1: Basic Market Creation
- [ ] Connected wallet has > 0.5 SOL
- [ ] Click "Create Market" button
- [ ] Modal opens with form
- [ ] Enter question: "Will Bitcoin reach $100k by March 2026?"
- [ ] Set duration: 24 hours
- [ ] Expiry date displays correctly
- [ ] Click "Create Market"
- [ ] Phantom prompts for transaction approval
- [ ] Approve transaction
- [ ] Success alert appears with transaction signature
- [ ] Market appears in dashboard grid
- [ ] Market shows:
  - [ ] Question text
  - [ ] $0.00 initial pool
  - [ ] Correct expiry date/time
  - [ ] "🔑 You own this market" badge

**Expected Result**: Market created successfully and visible

#### Test Case 2.2: Market Creation Validation
- [ ] Try creating market with empty question → Error
- [ ] Try creating market with 281+ characters → Error
- [ ] Try duration < 1 hour → Error
- [ ] Try duration > 8760 hours → Error

**Expected Result**: Proper validation errors

---

### 3. Place Bet (Happy Path)

#### Test Case 3.1: Place YES Bet
- [ ] Wallet has 10+ test USDC
- [ ] Click "Place Bet" on a market
- [ ] Modal opens
- [ ] Market question displays
- [ ] Current pool shows $0.00
- [ ] Expiry time displays
- [ ] Click "YES" button (should highlight)
- [ ] Enter amount: 5
- [ ] Privacy notice visible
- [ ] Click "Bet $5.00"
- [ ] Phantom prompts for approval
- [ ] Approve transaction
- [ ] Success alert with "Side: YES, Amount: $5.00"
- [ ] Modal closes
- [ ] Market card updates:
  - [ ] Pool shows $5.00
  - [ ] "Your Position: $5.00" appears

**Expected Result**: Bet placed, pool increased, position visible

#### Test Case 3.2: Place NO Bet
- [ ] Use different wallet OR same wallet
- [ ] Click "Place Bet" on same market
- [ ] Select "NO" (should highlight)
- [ ] Enter amount: 3
- [ ] Submit bet
- [ ] Transaction succeeds
- [ ] Pool now shows $8.00 ($5 + $3)

**Expected Result**: Second bet added to pool

#### Test Case 3.3: Multiple Bets Same User
- [ ] Place another bet on same market
- [ ] Use same side as before
- [ ] Enter amount: 2
- [ ] Submit
- [ ] Position should update to total ($7 if YES)

**Expected Result**: Position accumulates

#### Test Case 3.4: Bet Validation
- [ ] Try betting $0 → Error
- [ ] Try betting negative amount → Error
- [ ] Try betting with insufficient USDC → Transaction fails

**Expected Result**: Proper validation

---

### 4. Resolve Market (Authority Only)

#### Test Case 4.1: Premature Resolution
- [ ] As market authority
- [ ] Try resolving BEFORE expiry
- [ ] Should fail with "Market has not expired yet"

**Expected Result**: Cannot resolve early

#### Test Case 4.2: Successful Resolution - YES Wins
- [ ] Wait for market to expire (or create market with 1 minute expiry)
- [ ] Market card shows expiry warning
- [ ] Two buttons appear: "✅ YES" and "❌ NO"
- [ ] Click "✅ YES"
- [ ] Phantom prompts for approval
- [ ] Approve transaction
- [ ] Success alert: "Market resolved as YES!"
- [ ] Market card updates:
  - [ ] "✅ YES" badge appears
  - [ ] Resolve buttons disappear
  - [ ] "Place Bet" button disabled

**Expected Result**: Market resolved as YES

#### Test Case 4.3: Non-Authority Cannot Resolve
- [ ] Connect different wallet (not market creator)
- [ ] Resolve buttons should NOT appear

**Expected Result**: Only authority sees resolve buttons

---

### 5. Claim Payout

#### Test Case 5.1: Winner Claims
- [ ] Market resolved as YES
- [ ] Wallet bet on YES side
- [ ] "💰 Claim Payout" button visible
- [ ] Check USDC balance: `spl-token balance <MINT>`
- [ ] Click "Claim Payout"
- [ ] Phantom prompts for approval
- [ ] Approve transaction
- [ ] Success alert: "Payout claimed!"
- [ ] Button changes to "✓ Already Claimed"
- [ ] Check USDC balance again
- [ ] Balance increased by payout amount

**Expected Result**: Winner receives payout

#### Test Case 5.2: Loser Claims Nothing
- [ ] Wallet bet on NO side (market resolved YES)
- [ ] Click "Claim Payout"
- [ ] Transaction succeeds but receives $0
- [ ] Position marked as claimed

**Expected Result**: Loser gets nothing

#### Test Case 5.3: Double Claim Prevention
- [ ] After successfully claiming
- [ ] Try claiming again
- [ ] Should see "✓ Already Claimed" (no button)

**Expected Result**: Cannot claim twice

---

## Arcium MXE Testing

### Mock Client Verification
- [ ] Open browser console
- [ ] Place bet
- [ ] See "📊 [Arcium Mock] Bet recorded" log
- [ ] Verify side and amount in log
- [ ] Resolve market
- [ ] See "✅ [Arcium Mock] Winner payout computed" log
- [ ] See "❌ [Arcium Mock] Loser (no payout)" log

**Expected Result**: Arcium mock logs appear correctly

---

## Multi-User Scenario

### Setup
- [ ] Create market with authority wallet
- [ ] Place $10 YES bet (authority)
- [ ] Switch to second wallet
- [ ] Place $5 NO bet (user 2)
- [ ] Switch to third wallet
- [ ] Place $5 YES bet (user 3)
- [ ] Total pool: $20

### Resolution & Payouts
- [ ] Wait for expiry
- [ ] Authority resolves as YES
- [ ] Expected payouts:
  - Authority (YES $10): (10/15) × $20 = $13.33
  - User 2 (NO $5): $0
  - User 3 (YES $5): (5/15) × $20 = $6.67
- [ ] Each user claims
- [ ] Verify payout amounts match

**Expected Result**: Proportional payouts to winners

---

## Edge Cases

### Market Expiry Edge Cases
- [ ] Create market expiring in 5 seconds
- [ ] Try betting at 3 seconds → Should succeed
- [ ] Wait for expiry
- [ ] Try betting after expiry → Should fail "Market has expired"

### Zero Pool Resolution
- [ ] Create market
- [ ] Don't place any bets
- [ ] Wait for expiry
- [ ] Resolve market
- [ ] No errors should occur

### Single Bet Market
- [ ] Create market
- [ ] One user bets $10 YES
- [ ] No opposing bets
- [ ] Resolve as YES
- [ ] User claims $10 (gets original bet back)

**Expected Result**: All edge cases handled gracefully

---

## Performance & UX

### Loading States
- [ ] All buttons show "Loading..." or "..." during transactions
- [ ] Buttons disabled during processing
- [ ] No double-submission possible

### Error Handling
- [ ] Reject transaction in Phantom → Shows error, app doesn't break
- [ ] Disconnect wallet mid-flow → Graceful handling
- [ ] Insufficient funds → Clear error message

### Responsive Design
- [ ] Test on mobile viewport
- [ ] Test on tablet viewport
- [ ] Test on desktop
- [ ] All elements readable and clickable

---

## Anchor Tests

### Run Test Suite
```bash
cd /workspaces/nexora
anchor test
```

- [ ] All tests pass
- [ ] "Creates a market" ✅
- [ ] "Places a bet" ✅
- [ ] "Resolves market (after expiry)" ✅
- [ ] "Claims payout" ✅

**Expected Result**: 4/4 tests passing

---

## Security Verification

### PDA Validation
- [ ] Vault is a PDA (no external authority)
- [ ] User positions use correct seeds
- [ ] Market uses correct seeds

### Access Control
- [ ] Only authority can resolve
- [ ] Anyone can create market
- [ ] Anyone can bet (if not expired)
- [ ] Only position owner can claim

### Double-Spend Prevention
- [ ] Cannot claim twice
- [ ] Cannot resolve twice
- [ ] Cannot bet after expiry
- [ ] Cannot bet after resolution

---

## Documentation Verification

- [ ] README_DEPLOYMENT.md exists and is complete
- [ ] ARCIUM_INTEGRATION.md exists and explains MXE
- [ ] All code has inline comments
- [ ] IDL accurately reflects program structure

---

## Production Readiness Checklist

### Before Mainnet
- [ ] Replace ArciumMockClient with real Arcium SDK
- [ ] Implement Arcium signature verification in claim
- [ ] Security audit completed
- [ ] All tests passing
- [ ] Error monitoring set up
- [ ] Rate limiting implemented
- [ ] Circuit breakers for large payouts
- [ ] Documentation complete

---

## Known Issues / Limitations

- ⚠️ Arcium MXE is mocked for devnet
- ⚠️ No WebSocket updates (manual refresh needed)
- ⚠️ Single token support (USDC only)
- ⚠️ No market cancellation feature
- ⚠️ Payout verification relies on trust in devnet

---

## Sign-off

- [ ] All critical tests passed
- [ ] No blocking issues
- [ ] Ready for devnet demo

**Tester Name**: _________________

**Date**: _________________

**Signature**: _________________

---

## Support

If you encounter issues:
1. Check console logs in browser
2. Check `solana logs` in terminal
3. Verify all configuration in README_DEPLOYMENT.md
4. Check GitHub Issues
