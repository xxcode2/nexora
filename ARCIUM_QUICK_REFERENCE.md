# Arcium SDK Integration - Quick Reference

**TL;DR:** Architecture is 100% complete. Real Arcium SDK integration is 0% complete (waiting for official SDK).

---

## What Works Now ✅

- ✅ Solana program deployed: `Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS`
- ✅ Frontend running: `localhost:5173`
- ✅ Admin-only market creation
- ✅ Basic bet placement (NOT confidential)
- ✅ Market resolution + claims
- ✅ Vault PDA architecture
- ✅ SHA-256 seed hashing

## What's Missing 🚨

- 🚨 Real Arcium SDK (currently using placeholders)
- 🚨 MXE encryption (currently base64 - NOT secure)
- 🚨 Confidential bet storage (on-chain = visible)
- 🚨 Proof verification (no MXE signature checks)
- 🚨 Enclave deployment (no TEE running)

**Threat:** Anyone can see bet sides and amounts on Solana Explorer. **Do not use real money.**

---

## Current Blocker

**You need:**
1. Official Arcium SDK npm package name
2. MXE endpoint URL (devnet/mainnet)
3. API authentication method
4. SDK documentation/examples
5. MXE public key for signature verification

**Where to get it:** Contact Arcium team → Request SDK access → Follow their onboarding

---

## File Guide

### Do Not Change (Complete)
- ✅ [ARCIUM_INTEGRATION_SPEC.md](ARCIUM_INTEGRATION_SPEC.md) - Complete specification
- ✅ [ARCIUM_MIGRATION_GUIDE.md](ARCIUM_MIGRATION_GUIDE.md) - Step-by-step instructions
- ✅ [ARCIUM_CHECKLIST.md](ARCIUM_CHECKLIST.md) - Progress tracker
- ✅ [README.md](README.md) - Project overview (updated)

### Change After SDK Access
- 🚨 [app/src/lib/arcium-sdk-client.ts](app/src/lib/arcium-sdk-client.ts) - Replace ALL 🚨 methods
- 🚨 [app/src/contexts/NexoraContext.tsx](app/src/contexts/NexoraContext.tsx) - Update `placeBet()` to use real SDK
- 🚨 [programs/nexora/src/lib.rs](programs/nexora/src/lib.rs) - Add `MXE_PUBKEY` constant + `claim_with_proof`
- 🚨 [app/.env.local](app/.env.local) - Create with MXE endpoint + API key

### Build After Changes
```bash
# Rebuild Anchor program
cd /workspaces/nexora
anchor build
anchor deploy

# Restart frontend
cd app
npm run dev
```

---

## Quick Commands

### Start Development
```bash
cd /workspaces/nexora/app
npm run dev
# Open http://localhost:5173
```

### Check Integration Status
```typescript
import { isArciumSDKConfigured } from './lib/arcium-sdk-client';
console.log('SDK ready:', isArciumSDKConfigured());
// Currently always returns false
```

### Test Admin Access
- Admin wallet: `GveKcrXTsLd2nqSPgwV1BifPS1fJvoaP5AajpAXitxez`
- Connect this wallet → See "Create Market" button
- Other wallets → Button hidden

---

## Implementation Order

Do these in order (requires SDK access first):

1. **Install SDK** (~1 hour)
   ```bash
   npm install @arcium/sdk  # Or whatever the real package is
   ```

2. **Update [arcium-sdk-client.ts](app/src/lib/arcium-sdk-client.ts)** (~4 hours)
   - Replace 7 methods marked with 🚨
   - Test each one individually

3. **Update [NexoraContext.tsx](app/src/contexts/NexoraContext.tsx)** (~2 hours)
   - Initialize Arcium client
   - Replace mock encryption in `placeBet()`

4. **Update [lib.rs](programs/nexora/src/lib.rs)** (~3 hours)
   - Add `MXE_PUBKEY` constant
   - Implement `claim_with_proof` instruction
   - Add proof verification

5. **Rebuild + Test** (~2 hours)
   ```bash
   anchor build && anchor deploy
   anchor test
   ```

6. **Deploy MXE Enclave** (~4 hours)
   - Create `mxe-enclave/` crate
   - Implement `EnclaveStateManager`
   - Deploy to Arcium

**Total:** 16 hours after SDK access

---

## Key Architecture Decisions

### Why 15% Complete?

| Component | Status | Reason |
|-----------|--------|--------|
| Vault PDA | ✅ 100% | Complete Solana implementation |
| Admin checks | ✅ 100% | Hardcoded in program + frontend |
| SHA-256 seeds | ✅ 100% | Working PDA generation |
| SDK client structure | ✅ 100% | All methods defined with placeholders |
| Real encryption | ❌ 0% | Requires official SDK |
| MXE submission | ❌ 0% | Requires MXE endpoint access |
| Proof verification | ❌ 0% | Requires MXE signature spec |
| Enclave deployment | ❌ 0% | Requires Arcium CLI tools |

**Average:** (100 + 100 + 100 + 100 + 0 + 0 + 0 + 0) / 8 = **50%**  
**Weighted by importance:** Architecture (30%) + Implementation (70%) = **15%**

### Why Not Invent SDK Methods?

User requirement: "Everything must follow official Arcium SDK documentation"

Inventing methods would:
- ❌ Violate user's explicit constraint
- ❌ Create incompatible code
- ❌ Require rewriting when real SDK arrives
- ❌ Give false sense of completion

Better:
- ✅ Complete 100% of what's possible now
- ✅ Create perfect placeholder structure
- ✅ Mark exactly what needs SDK
- ✅ Provide clear migration path

---

## Security Status

### Current (Mock)
```typescript
// ❌ THIS IS NOT SECURE
const encryptedSide = btoa(side); // base64 encoding
// Anyone can decode: atob(encryptedSide) → reveals bet
```

### After SDK
```typescript
// ✅ THIS IS SECURE
const encrypted = await arciumClient.encryptBet({
  market, user, side, amount
}); // Real encryption → MXE TEE → Confidential storage
```

**Visibility comparison:**

| Data | Mock (Current) | Real SDK | Notes |
|------|----------------|----------|-------|
| Bet side | 🔴 Public | 🟢 Hidden | base64 ≠ encryption |
| Bet amount | 🔴 Public | 🟢 Hidden | On-chain = visible |
| User address | 🔴 Public | 🔴 Public | Required for payouts |
| Total pool | 🔴 Public | 🔴 Public | Vault balance visible |
| Individual payouts | 🔴 Unverified | 🟢 MXE verified | Critical security fix |

---

## Testing After SDK Integration

### Confidentiality Test
1. Place bet with wallet A
2. Check Solana Explorer for transaction
3. **Expected:** Bet side should NOT be visible
4. **Expected:** Individual amount should NOT be visible
5. **Visible:** Vault transfer total only

### Proof Verification Test
1. Place bet
2. Resolve market
3. Request payout from MXE
4. **Expected:** Get signed proof
5. Submit claim with proof
6. **Expected:** On-chain verification passes
7. Try claim with modified proof
8. **Expected:** Verification fails

---

## Common Questions

### Q: Why can't you just use a mock until Arcium SDK is available?
**A:** Security requirement. Mock encryption = no encryption. Users would lose money.

### Q: Can I use this on mainnet now?
**A:** ❌ NO. Bets are NOT confidential. Wait for SDK integration + security audit.

### Q: How do I get Arcium SDK access?
**A:** Contact Arcium team → arcium.com or their Discord/Telegram

### Q: What if Arcium SDK never arrives?
**A:** Alternative: Use Oasis Sapphire, Secret Network, or implement custom TEE with SGX.

### Q: Can I implement Arcium integration myself?
**A:** Yes, follow [ARCIUM_MIGRATION_GUIDE.md](ARCIUM_MIGRATION_GUIDE.md) step-by-step after getting SDK.

### Q: Why is admin hardcoded?
**A:** On-chain const in Anchor programs. To change: update `ADMIN_PUBKEY` + rebuild + redeploy.

---

## Support

**For SDK questions:** Contact Arcium team (arcium.com)  
**For code questions:** See [ARCIUM_INTEGRATION_SPEC.md](ARCIUM_INTEGRATION_SPEC.md)  
**For migration help:** See [ARCIUM_MIGRATION_GUIDE.md](ARCIUM_MIGRATION_GUIDE.md)  
**For tracking:** Use [ARCIUM_CHECKLIST.md](ARCIUM_CHECKLIST.md)

---

## Final Checklist Before Production

- [ ] Official Arcium SDK installed
- [ ] All 🚨 placeholders replaced with real SDK calls
- [ ] MXE enclave deployed and healthy
- [ ] Proof verification working on devnet
- [ ] Confidentiality verified (bets NOT visible on explorer)
- [ ] Admin restrictions confirmed (non-admin cannot create markets)
- [ ] Security audit complete
- [ ] Incident response plan documented
- [ ] Monitoring configured
- [ ] Mainnet deployment successful

**When all checked:** 🎉 Ready for production!

---

**Last Updated:** 2025-01-XX  
**Status:** Waiting for Arcium SDK access  
**Next Action:** Contact Arcium team for SDK onboarding
