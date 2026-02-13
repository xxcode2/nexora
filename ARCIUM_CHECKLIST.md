# Arcium Integration Checklist

Track your progress migrating from mock → real Arcium SDK integration.

**Progress:** 15% Complete (Architecture only)

---

## Phase 1: Obtain Access ⏳

- [ ] **Get Arcium SDK documentation**
  - Official docs URL: ___________________________
  - GitHub repo: ___________________________
  - Example code: ___________________________

- [ ] **Get Arcium credentials**
  - MXE devnet endpoint: ___________________________
  - MXE mainnet endpoint: ___________________________
  - API key: ___________________________
  - Auth token: ___________________________

- [ ] **Test MXE access**
  - [ ] Ping devnet endpoint
  - [ ] Verify authentication works
  - [ ] Check rate limits
  - [ ] Test simple encryption

---

## Phase 2: SDK Installation ⏳

- [ ] **Install SDK package**
  ```bash
  npm install @arcium/sdk  # Or whatever official package name
  ```

- [ ] **Verify installation**
  ```bash
  npm list @arcium/sdk
  ```

- [ ] **Check TypeScript types**
  - [ ] `ArciumClient` type available
  - [ ] `EncryptionConfig` type available
  - [ ] Method signatures match expectations

---

## Phase 3: Client Implementation ⏳

File: [app/src/lib/arcium-sdk-client.ts](app/src/lib/arcium-sdk-client.ts)

- [ ] **Replace type placeholders**
  - [ ] Import real `ArciumClient` from SDK
  - [ ] Import real `EncryptionConfig` from SDK
  - [ ] Remove `type ArciumClient = any;` placeholder

- [ ] **Implement constructor**
  - [ ] Initialize `ArciumClient` with config
  - [ ] Test connection on init
  - [ ] Add error handling

- [ ] **Implement encryptBet()**
  - [ ] Use official SDK encryption method
  - [ ] Return correct `EncryptedPayload` structure
  - [ ] Test with sample bet

- [ ] **Implement submitBetToMXE()**
  - [ ] Use official MXE submission API
  - [ ] Parse transaction ID from response
  - [ ] Handle network errors

- [ ] **Implement requestPayout()**
  - [ ] Use official MXE query API
  - [ ] Validate proof structure
  - [ ] Verify signature format

- [ ] **Implement verifyMXESignature()**
  - [ ] Get MXE public key
  - [ ] Use SDK verification method
  - [ ] Test with known valid/invalid signatures

- [ ] **Implement getMXEPublicKey()**
  - [ ] Query SDK for enclave pubkey
  - [ ] Convert to Solana base58 format
  - [ ] Cache for performance

- [ ] **Update isArciumSDKConfigured()**
  - [ ] Check SDK installation
  - [ ] Check environment config
  - [ ] Test MXE connectivity

---

## Phase 4: Context Integration ⏳

File: [app/src/contexts/NexoraContext.tsx](app/src/contexts/NexoraContext.tsx)

- [ ] **Import Arcium client**
  ```typescript
  import { createArciumClient, isArciumSDKConfigured } from '../lib/arcium-sdk-client';
  ```

- [ ] **Initialize client in context**
  - [ ] Add state: `const [arciumClient] = useState(...)`
  - [ ] Check `isArciumSDKConfigured()` before init
  - [ ] Log warning if not configured

- [ ] **Update placeBet() method**
  - [ ] Remove mock encryption: `btoa(side)`
  - [ ] Add real encryption: `await arciumClient.encryptBet(...)`
  - [ ] Submit to MXE: `await arciumClient.submitBetToMXE(...)`
  - [ ] Store MXE transaction ID for user

- [ ] **Add claim flow**
  - [ ] Request payout from MXE
  - [ ] Construct proof object
  - [ ] Call `claimWithProof` instruction

---

## Phase 5: Anchor Program Updates ⏳

File: [programs/nexora/src/lib.rs](programs/nexora/src/lib.rs)

- [ ] **Add MXE public key constant**
  ```rust
  pub const MXE_PUBKEY: Pubkey = pubkey!("...");
  ```
  - MXE pubkey (from Arcium): ___________________________

- [ ] **Create ArciumPayoutProof struct**
  - [ ] `mxe_signature: [u8; 64]`
  - [ ] `timestamp: i64`
  - [ ] `payout_amount: u64`

- [ ] **Create ClaimWithProof accounts**
  - [ ] Add `mxe_signer: AccountInfo`
  - [ ] Add constraint checking MXE pubkey
  - [ ] Add remaining accounts (vault, user token, etc.)

- [ ] **Implement claim_with_proof()**
  - [ ] Check market is closed
  - [ ] Verify MXE signature
  - [ ] Check proof timestamp (not expired)
  - [ ] Transfer payout from vault
  - [ ] Emit event

- [ ] **Add helper functions**
  - [ ] `construct_payout_message()` for signature verification
  - [ ] Message format matches MXE expectations

- [ ] **Add error codes**
  - [ ] `InvalidMXESignature`
  - [ ] `ProofExpired`

- [ ] **Build and deploy**
  ```bash
  anchor build
  anchor deploy --provider.cluster devnet
  ```

---

## Phase 6: Frontend Updates ⏳

File: [app/src/components/Dashboard.tsx](app/src/components/Dashboard.tsx)

- [ ] **Update claim button handler**
  - [ ] Request payout from MXE
  - [ ] Construct proof object
  - [ ] Get MXE pubkey
  - [ ] Call `claimWithProof` with all accounts

- [ ] **Add loading states**
  - [ ] "Requesting payout from MXE..."
  - [ ] "Verifying proof..."
  - [ ] "Claiming..."

- [ ] **Add error handling**
  - [ ] MXE unreachable
  - [ ] Invalid proof
  - [ ] Proof expired
  - [ ] Insufficient vault balance

- [ ] **Add success feedback**
  - [ ] Show claimed amount
  - [ ] Link to transaction

---

## Phase 7: Environment Setup ⏳

- [ ] **Create .env.local**
  ```bash
  VITE_ARCIUM_MXE_ENDPOINT=...
  VITE_ARCIUM_API_KEY=...
  VITE_ARCIUM_NETWORK=devnet
  ```

- [ ] **Update .gitignore**
  - [ ] Ensure `.env.local` is ignored
  - [ ] Never commit API keys

- [ ] **Document environment variables**
  - [ ] Add to README
  - [ ] Add example `.env.example` file

---

## Phase 8: MXE Enclave Deployment ⏳

- [ ] **Create enclave crate**
  - Directory: `mxe-enclave/`
  - [ ] `Cargo.toml` with dependencies
  - [ ] `src/lib.rs` with `EnclaveStateManager`

- [ ] **Implement confidential storage**
  - [ ] `record_bet()` method
  - [ ] `compute_payout()` method
  - [ ] `resolve_market()` method

- [ ] **Test locally (if possible)**
  - [ ] Unit tests for payout logic
  - [ ] Test with sample data

- [ ] **Deploy to Arcium MXE**
  ```bash
  # Use Arcium CLI
  arcium deploy --enclave mxe-enclave/ --network devnet
  ```
  - Deployment ID: ___________________________

- [ ] **Verify deployment**
  - [ ] Health check passes
  - [ ] Can submit test operation
  - [ ] Can query test result

---

## Phase 9: Testing ⏳

### Unit Tests

- [ ] **SDK client tests**
  ```bash
  cd app && npm test
  ```
  - [ ] `encryptBet()` produces valid ciphertext
  - [ ] `submitBetToMXE()` returns transaction ID
  - [ ] `requestPayout()` returns signed proof
  - [ ] `verifyMXESignature()` validates correctly

- [ ] **Program tests**
  ```bash
  anchor test
  ```
  - [ ] `claim_with_proof` accepts valid proof
  - [ ] `claim_with_proof` rejects invalid signature
  - [ ] `claim_with_proof` rejects expired proof

### Integration Tests

- [ ] **End-to-end flow (devnet)**
  1. [ ] Admin creates market
  2. [ ] User places confidential bet
  3. [ ] Verify bet NOT visible on-chain
  4. [ ] Admin resolves market
  5. [ ] User requests payout from MXE
  6. [ ] User claims with proof
  7. [ ] Verify correct payout amount received

- [ ] **Security tests**
  - [ ] Cannot claim with forged proof
  - [ ] Cannot replay old proof
  - [ ] Cannot claim before market closed
  - [ ] Cannot claim more than once

### Manual Testing

- [ ] **Connect wallet**
  - [ ] Admin wallet connects
  - [ ] Regular user wallet connects

- [ ] **Create market (admin only)**
  - [ ] Create market succeeds
  - [ ] Non-admin cannot create

- [ ] **Place bet**
  - [ ] Encryption succeeds
  - [ ] MXE submission succeeds
  - [ ] Transaction ID returned
  - [ ] Bet NOT visible on Solana Explorer

- [ ] **Resolve market**
  - [ ] Admin can resolve
  - [ ] Winning side recorded

- [ ] **Claim payout**
  - [ ] Payout request succeeds
  - [ ] Proof returned
  - [ ] Claim instruction succeeds
  - [ ] Correct amount transferred

---

## Phase 10: Production Deployment ⏳

### Pre-deployment

- [ ] **Security audit**
  - [ ] Program audited by professional
  - [ ] SDK integration reviewed
  - [ ] MXE enclave reviewed

- [ ] **Configuration review**
  - [ ] Admin pubkey correct for production
  - [ ] MXE endpoint is mainnet
  - [ ] USDC mint is mainnet
  - [ ] Program ID matches deployed program

- [ ] **Monitoring setup**
  - [ ] MXE health monitoring
  - [ ] Error rate alerts
  - [ ] Transaction failure alerts
  - [ ] Payout anomaly detection

### Deployment

- [ ] **Deploy Anchor program**
  ```bash
  anchor deploy --provider.cluster mainnet
  ```
  - Program ID: ___________________________

- [ ] **Deploy MXE enclave (mainnet)**
  ```bash
  arcium deploy --enclave mxe-enclave/ --network mainnet
  ```
  - Deployment ID: ___________________________

- [ ] **Deploy frontend**
  ```bash
  cd app && npm run build
  # Deploy to hosting
  ```
  - Production URL: ___________________________

### Post-deployment

- [ ] **Smoke tests**
  - [ ] Create test market
  - [ ] Place small test bet
  - [ ] Resolve and claim

- [ ] **Documentation**
  - [ ] Update README with production info
  - [ ] Document admin procedures
  - [ ] Write incident response plan

- [ ] **Monitoring**
  - [ ] Check logs for errors
  - [ ] Monitor MXE uptime
  - [ ] Monitor transaction success rate

---

## Success Criteria ✅

Mark complete when ALL of these are true:

- [ ] **SDK fully integrated** (no placeholders)
- [ ] **Bets are confidential** (not visible on-chain)
- [ ] **MXE verification works** (claims require valid proof)
- [ ] **All tests pass** (unit + integration)
- [ ] **Production deployed** (mainnet running)
- [ ] **Monitoring active** (alerts configured)

**Target:** 100% Complete ✅

---

## Notes

Use this space to track blockers, questions, or important discoveries:

```
[2025-01-XX] Obtained Arcium SDK access - version 1.2.3
[2025-01-XX] MXE devnet endpoint: https://...
[2025-01-XX] Issue: signature verification failing - fixed by...
[2025-01-XX] Integration complete - deployed to mainnet
```

---

## Resources

- **Specification:** [ARCIUM_INTEGRATION_SPEC.md](ARCIUM_INTEGRATION_SPEC.md)
- **Migration Guide:** [ARCIUM_MIGRATION_GUIDE.md](ARCIUM_MIGRATION_GUIDE.md)
- **SDK Client:** [app/src/lib/arcium-sdk-client.ts](app/src/lib/arcium-sdk-client.ts)
- **Anchor Program:** [programs/nexora/src/lib.rs](programs/nexora/src/lib.rs)

---

**Last Updated:** 2025-01-XX  
**Status:** Phase 1 (Waiting for Arcium SDK access)
