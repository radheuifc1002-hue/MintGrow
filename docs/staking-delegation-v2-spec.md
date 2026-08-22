# MintGrow staking/delegation v2 — frozen website/backend flow

## Principal flow

MGS staking is the only principal operation exposed by the product. There is no traditional wallet withdrawal and no user-facing MGS unstake/principal withdrawal.

```text
User wallet
  -> authorize MintGrow delegation address
  -> backend records active delegation authorization
  -> create stake request
  -> Admin staking queue
  -> Admin connects staking-contract admin wallet
  -> cross-verifies wallet / delegation / amount
  -> executes staking transaction on BNB Chain
  -> backend records broadcast + confirmation
  -> stake becomes confirmed
```

The website must never display a stake as successful until the transaction is confirmed on-chain.

## Current thresholds

- Minimum stake: **250,000 MGS** initially.
- Minimum MG reward claim: **25,000 MG** initially.
- Both are configuration values so the frontend follows the governance configuration when changed.
- Do not put an income/reward cap into the game UI or Admin Panel.

## Delegation

The user authorizes the configured MintGrow delegation address. The authorization must be scoped and amount-limited. A staking request cannot enter the admin queue unless there is an active delegation authorization covering the requested MGS amount.

The eventual delegation contract must be behind a governance-controlled proxy and must not expose arbitrary external execution. It will be limited to the exact MG/MGS approval and staking/claim operations required by MintGrow.

The current branch only records and validates the authorization at the website/backend boundary because the Solidity redesign is intentionally deferred.

## Staking

The final contract flow will be:

```text
User MGS
   ↓
Delegation address / authorized operator
   ↓
MGSStaking
   ↓
MGS remains locked
```

No normal `unstake()` or principal withdrawal exists in the product flow.

## Reward model

For a stake of 250,000 MGS:

```text
250,000 MGS principal
       ↓
250,000 MG 1:1 base entitlement
       +
ROI accrual
```

ROI uses exactly **86,400 seconds per day**. Every ROI change creates a checkpoint. Accrual before the change uses the old rate; accrual after the change uses the new rate. No retroactive repricing.

Example:

```text
Day 1: 1.00%
Day 2: 2.00%
Day 3: 0.50%
```

The Day-1 accrual remains calculated at 1%, even after the rate becomes 2%.

## MG reward claim

Only accumulated MG rewards can be claimed through the Telegram frontend.

```text
Confirmed stake
   ↓
ROI/base rewards accumulate
   ↓
claimable MG >= minimum claim
   ↓
Telegram frontend creates claim request
   ↓
staking-contract claim flow
   ↓
MG delivered to user's wallet
```

The legacy `withdrawals` table/RPC is no longer an application path. The backend uses `staking_claim_requests` for staking-contract reward claims.

## Admin

The Admin Panel has separate operational queues for:

1. Stake requests.
2. Authorized delegations.
3. Staking-contract MG reward claims.

The Admin Panel requires the configured staking-contract admin wallet to be connected before marking an on-chain operation as broadcast/confirmed. Until the new Solidity ABI is deployed, the UI records the operation lifecycle but does not call the old staking contract.

## Governance

Governance will eventually control:

- minimum stake
- minimum MG claim
- ROI rate/checkpoints
- delegation proxy implementation
- delegation operator permissions
- emergency pause

No frontend hardcoded economic threshold should override the governance configuration.
