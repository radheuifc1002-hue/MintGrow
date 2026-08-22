# MintGrow V2 Deployment & Upgrade Guide

This document covers the V2 staking/delegation deployment on BNB Chain and BNB Testnet.

## 1. V2 architecture

The deployment contains:

- `MGToken` — original MG ERC-20.
- `MGSToken` — original MGS ERC-20. V2 staking mints MGS directly to the staking contract.
- `MintGrowControllerV2` — timestamp-checkpointed ROI controller.
- `MGStakingMinterV2` — only staking contract can mint MG rewards through this gateway.
- `MintGrowStakingV2` — stake-only state machine. No user MGS transfer and no unstake/principal withdrawal.
- `MintGrowStakingProxyV2` — stable upgradeable staking address.
- `MintGrowStakeDelegationV2` — narrowly scoped sponsored staking gateway.
- `MintGrowStakeDelegationProxyV2` — stable delegation address that users authorize.

## 2. Required roles and ownership

Final target:

```text
Multisig
 ├── MG/MGS default administration
 ├── staking admin
 ├── controller admin
 ├── delegation admin
 ├── reward-minter admin
 └── ProxyAdmin ownership

MGToken
 └── MINTER_ROLE -> MGStakingMinterV2

MGSToken
 └── MINTER_ROLE -> MintGrowStakingProxyV2

MGStakingMinterV2
 └── staking -> MintGrowStakingProxyV2

MintGrowStakingV2
 ├── delegation -> MintGrowStakeDelegationProxyV2
 ├── controller -> ControllerV2
 ├── rewardMinter -> MGStakingMinterV2
 └── earningAttester -> backend signing key

DelegationV2
 ├── sponsor -> funded transaction wallet
 └── staking -> MintGrowStakingProxyV2
```

The sponsor is only the funded transaction sender. It is not a token minter and must not receive a general-purpose execution capability.

## 3. Environment

Create a deployment-only environment file outside git:

```text
DEPLOYER_PRIVATE_KEY=...
BSC_TESTNET_RPC_URL=https://...
BSC_RPC_URL=https://...
MULTISIG_ADDRESS=0x...
SPONSOR_ADDRESS=0x...
EARNING_ATTESTER_ADDRESS=0x...
INITIAL_ROI_BPS=100
MIN_ROI_BPS=0
MAX_ROI_BPS=1000
TOKEN_ADMIN_DELAY=0
```

`100` BPS = 1% per 86,400-second day.

Never put a private key in Expo environment variables, Supabase database rows, GitHub source, or the Admin Panel.

## 4. Install and compile

```bash
npm install
npm run contracts:compile
```

Do not deploy if compilation fails.

## 5. Testnet deployment

```bash
npm run contracts:deploy:testnet
```

The script writes:

```text
deployments/bsc-v2-97.json
```

The deployment script intentionally deploys the two transparent proxies with empty initialization data first. This is required because the staking proxy and delegation proxy reference each other. Both are then initialized after their addresses are known.

## 6. Production deployment

Only after testnet tests and manual flow verification:

```bash
npm run contracts:deploy:bsc
```

The script writes:

```text
deployments/bsc-v2-56.json
```

Verify every address from the output before changing frontend/backend environment variables.

## 7. Token admin handoff

The deployment signer temporarily owns MG/MGS default administration so it can configure minter and operational roles. It does **not** remain the production admin.

The script prints:

```text
MGToken.beginDefaultAdminTransfer(MULTISIG_ADDRESS)
MGSToken.beginDefaultAdminTransfer(MULTISIG_ADDRESS)
```

Execute those transactions, then have the multisig execute:

```text
acceptDefaultAdminTransfer()
```

on both tokens.

After acceptance, verify that the deployer has no operational roles.

## 8. Mandatory post-deployment verification

Check all of the following before enabling staking:

### MG

- `MINTER_ROLE` contains only `MGStakingMinterV2` plus any explicitly approved future minters.
- `MGStakingMinterV2.token == MGToken`.
- `MGStakingMinterV2.staking == StakingProxyV2`.

### MGS

- `MINTER_ROLE` contains `StakingProxyV2`.
- No game/frontend wallet has `MINTER_ROLE`.
- `StakingProxyV2.mgs == MGSToken`.

### Staking

- `admin == MULTISIG_ADDRESS`.
- `delegation == DelegationProxyV2`.
- `controller == ControllerV2`.
- `rewardMinter == MGStakingMinterV2`.
- `earningAttester == the exact backend attestation public key`.
- `minimumStake == 250000 * 1e18`.
- `minimumClaim == 25000 * 1e18`.
- `paused == false` only after all checks pass.

### Delegation

- `admin == MULTISIG_ADDRESS`.
- `sponsor == the funded transaction wallet`.
- `staking == StakingProxyV2`.
- Only the configured sponsor can submit delegated staking.

### Controller

- `admin == MULTISIG_ADDRESS`.
- Initial ROI matches the launch configuration.
- ROI bounds are correct.
- `active == true` only when staking is ready.

## 9. User staking flow

```text
User earns eligible balance off-chain
        -> reaches 250,000 MG-equivalent threshold
        -> connects EOA
        -> signs delegation authorization
        -> funded sponsor submits request
        -> delegation proxy verifies user signature
        -> staking proxy verifies backend earning voucher
        -> staking contract mints MGS to itself
        -> stake becomes PENDING
        -> admin reviews gameplay/referrals/earning evidence
        -> multisig approves on-chain
        -> stake becomes ACTIVE
```

The backend must not mark a stake successful before the chain receipt confirms `StakeApproved`.

## 10. Rejection flow

A pending request may be rejected by the staking admin.

The staking contract burns the MGS that it minted for the pending request. No MGS is sent to the user's EOA.

The backend releases the reserved off-chain earning balance only after observing the rejection transaction/receipt.

## 11. Reward claim flow

The user's MGS principal remains inside the staking contract.

The user can call `claimReward()` from the Telegram frontend after the claimable MG balance reaches the current on-chain `minimumClaim` value.

The claim mints MG through `MGStakingMinterV2` directly to the user's EOA.

There is no traditional withdrawal system and no MGS principal withdrawal.

## 12. ROI changes

ROI uses 86,400 seconds per day. Every rate change creates a checkpoint. Accrual before the checkpoint uses the previous rate; accrual after it uses the new rate.

Example:

```text
Day 1: 1%
Day 2: 2%
Day 3: 0.5%
```

No historical reward is retroactively repriced.

## 13. Existing deployment migration

Do **not** point the new frontend at the old `MGSStaking.sol` deployment.

The old system has different semantics, including user principal withdrawal. V2 is a new staking state machine and therefore requires a new staking proxy address.

Migration sequence:

1. Pause the old staking system.
2. Stop creating new old-model stake requests.
3. Finish/reconcile any old pending requests according to the old deployment's rules.
4. Deploy V2 on BNB testnet.
5. Run the full V2 test matrix.
6. Deploy V2 on BNB mainnet.
7. Complete token role/admin handoff.
8. Update Supabase/on-chain configuration with the new V2 addresses.
9. Update Expo `EXPO_PUBLIC_MG_STAKING`, `EXPO_PUBLIC_MG_STAKE_DELEGATION`, `EXPO_PUBLIC_MG_MGS_TOKEN` and related values.
10. Configure the same multisig and funded sponsor in backend secrets.
11. Verify one complete stake on-chain.
12. Only then enable the V2 staking UI.

Do not migrate old MGS principal automatically. The old and V2 economic models are intentionally different and must be reconciled explicitly.

## 14. Upgrade procedure

The stable addresses are the two proxy addresses:

- `StakingProxyV2`
- `DelegationProxyV2`

A future implementation upgrade must be executed by the proxy's `ProxyAdmin` owner, which must be the governance multisig.

Before every upgrade:

1. Compile from a clean checkout.
2. Run all unit/integration tests.
3. Compare storage layouts.
4. Confirm initializer cannot be called again.
5. Review all role/owner changes.
6. Test pause/recovery.
7. Test on BNB testnet.
8. Have the multisig execute the upgrade.
9. Verify implementation and proxy state on-chain.

Never use the deployment EOA as permanent proxy upgrade authority.

## 15. Security checklist

- [ ] No private keys in frontend/backend source.
- [ ] Sponsor has only BNB for gas and no mint roles.
- [ ] Earning attester key is separate from sponsor and multisig.
- [ ] MGS minter role is only staking proxy.
- [ ] MG reward minter role is only staking minter.
- [ ] Staking/delegation admins are multisig.
- [ ] ProxyAdmin owners are multisig.
- [ ] Stake signatures contain owner, sponsor, staking address, amount, nonce and deadline.
- [ ] Earning vouchers contain owner, amount, nonce and deadline.
- [ ] Voucher replay is impossible.
- [ ] Delegation replay is impossible.
- [ ] Pending stakes cannot be duplicated.
- [ ] MGS cannot be unstaked by users.
- [ ] Reward claims below the threshold revert.
- [ ] Backend does not decide on-chain stake state.
- [ ] Admin UI does not mark approval successful before chain confirmation.
- [ ] No arbitrary call/execute method exists in the delegation proxy.

## 16. Do not deploy if

- compilation fails;
- a role is controlled by an unexpected EOA;
- the multisig cannot perform the admin transaction;
- the sponsor is not the configured sponsor;
- the earning attester public key is wrong;
- the staking contract cannot mint MGS to itself;
- the reward minter cannot mint MG;
- the claim threshold differs between UI and chain;
- the Admin Panel cannot reconcile a real transaction receipt;
- any test permits user principal withdrawal.
