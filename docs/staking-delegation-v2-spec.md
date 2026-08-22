# MintGrow staking/delegation v2 specification

## Staking economics

- MGS is transferred into `MGSStaking` and remains locked. There is no normal `unstake()` or principal withdrawal.
- Minimum stake starts at `250,000 MGS` and is governance-controlled.
- A stake creates a 1:1 MG entitlement: `1 MGS staked => 1 MG base reward`.
- Base reward and ROI reward are claimable as MG; MGS principal is not returned through the normal user flow.
- Initial minimum MG reward claim/withdrawal is `25,000 MG`, governance-controlled.
- ROI uses an exact `86,400` second day. Rates are represented in basis points (1% = 100 bps).
- Changing ROI checkpoints the previous rate at the exact block timestamp. Accrual before the change uses the old rate; accrual after uses the new rate. No retroactive repricing.
- No income cap is shown in the game UI or admin UI.

## User/admin transaction flow

### Stake

```text
User connects wallet
  -> user authorizes delegation
  -> user creates staking request
  -> request appears in Admin Panel
  -> admin cross-verifies user, amount, delegation and allowance
  -> multisig wallet executes the on-chain stake transaction
  -> backend records tx hash/status
```

The website must not claim that staking succeeded until the on-chain transaction is confirmed.

### Claim / withdrawal of MG reward

```text
User -> claimReward()
```

The user may submit the claim transaction directly or through the existing gasless/delegated execution route. The gasless route is not a Paymaster: it is a funded transaction wallet executing an explicitly authorized operation.

## Delegation v2

The delegation target must be a stable proxy address governed by the MintGrow multisig/governance owner. The implementation must never contain a user-specific admin key.

The authorization must bind:

- owner
- delegate/operator
- chainId
- verifying contract
- nonce
- expiry
- operation scope
- token/target
- amount allowance

The authorized operator may execute only the scoped token operations required by MintGrow staking:

- MGS approval/permit path for staking
- MG approval/permit path for reward withdrawal/settlement where required
- staking `stakeFor`
- reward `claimRewardFor`

It must not provide arbitrary external `execute(address,uint256,bytes)` access. Token and staking targets/selectors are allowlisted and every spend consumes an allowance.

## Proxy requirement

Use a dedicated upgradeable proxy with a governance-controlled upgrade owner. The proxy address is the stable delegation target used by the authorization flow. Do not use an EIP-7702 target design that depends on proxy storage being initialized at the user's EOA unless the exact execution model is tested first; EIP-7702 delegation and ordinary proxy storage have different storage contexts.

## Governance

Governance controls:

- minimum stake
- minimum MG claim
- ROI rate
- ROI activation/deactivation
- delegation implementation upgrade
- authorized staking/delegation operator addresses
- emergency pause

Every economic configuration change emits an event and is timelocked where practical.
