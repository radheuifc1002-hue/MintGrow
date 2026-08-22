# MintGrow V2 on-chain staking architecture

This directory now contains the V2 staking architecture. **Do not deploy this code to BNB Chain yet.** It must first be compiled against the exact pinned OpenZeppelin version, unit/integration/fuzz/invariant tested, rehearsed on testnet, reviewed for proxy storage safety, and independently audited.

## Final V2 flow

```text
User earns >= 250,000 MGS
        |
        v
User connects wallet
        |
        v
User authorizes MintGrow delegation proxy to spend MGS
        |
        v
User signs scoped staking authorization
        |
        v
MintGrow-funded sponsor submits sponsored request
        |
        v
Delegation proxy transferFrom(user -> staking proxy)
        |
        v
Staking proxy records PENDING stake
        |
        v
Admin/multisig reviews request
   +----+----+
   |         |
approve    reject
   |         |
   v         v
ACTIVE     refund pending MGS
   |
   v
250,000 MGS remains locked in staking contract
   |
   +--> 250,000 MG base entitlement (1:1)
   |
   +--> ROI accrues by exact 86,400-second day
   |
   v
User calls claimReward() from Telegram frontend
   |
   +--> claim allowed only when >= minimumClaim (25,000 MG initially)
   |
   v
MG staking minter -> MG token -> user
```

There is **no normal unstake, principal withdrawal, or traditional backend withdrawal flow**. Once a stake is approved, the MGS principal remains in the staking contract permanently under this V2 design. A rejected pending request is refunded because it never became a stake.

## Token layer

- `MGToken.sol` — normal, non-upgradeable ERC-20. Minting is role-gated; burn, pause, blacklist and EIP-2612 permit are included.
- `MGSToken.sol` — normal, non-upgradeable ERC-20 with the same operational controls.

Only the designated staking minter may mint staking MG rewards.

## V2 staking contracts

- `MintGrowStakingV2.sol` — upgradeable staking implementation. It records pending requests, lets the governance/admin multisig approve or reject them, locks approved MGS principal, creates the 1:1 MG base entitlement, accrues ROI, and exposes only `claimReward()` for user reward claims.
- `MintGrowStakingProxyV2.sol` — Transparent Upgradeable Proxy. Its `ProxyAdmin` owner is the deployment governance/multisig.
- `MintGrowStakeDelegationV2.sol` — upgradeable, narrowly scoped sponsored staking gateway. It can only consume a user's MGS allowance for a signed staking authorization and forward the exact amount into the staking proxy.
- `MintGrowStakeDelegationProxyV2.sol` — stable Transparent Proxy address used as the delegation target.
- `MintGrowControllerV2.sol` — timestamp-checkpointed ROI controller using an exact 86,400-second day. Rate changes checkpoint the previous rate, so historical accrual remains at the rate active during that period.
- `MGStakingMinterV2.sol` — narrow MG mint gateway callable only by the V2 staking proxy.

## Sponsorship model

There is **no Paymaster requirement in V2**.

A single configured MintGrow-funded sponsor EOA submits the signed staking request and pays the BNB transaction fee. The delegation contract binds the sponsor address into the user's EIP-712 authorization, so a different relayer cannot reuse that authorization.

The sponsor does not receive arbitrary token execution rights and cannot choose an arbitrary destination or selector.

## Delegation security model

Each staking authorization binds:

- user/owner
- exact sponsor/relayer
- staking proxy
- MGS token
- exact amount
- per-user nonce
- expiry
- chain ID
- delegation proxy as EIP-712 verifying contract

The delegation proxy also requires an actual ERC-20 allowance from the user. A signed authorization alone cannot move MGS.

Users can revoke outstanding signed authorizations by incrementing their delegation nonce.

## Admin/multisig model

The staking implementation's `admin` is the production multisig address supplied during initialization.

The multisig is responsible for:

- approving pending stakes
- rejecting pending stakes
- changing minimum stake
- changing minimum claim threshold
- changing ROI controller
- changing delegation address
- changing staking minter
- emergency pause/unpause

The admin panel only prepares and submits these transactions through the connected multisig wallet. The backend never holds the multisig private key and never fabricates an on-chain stake.

The Transparent Proxy's separate `ProxyAdmin` is also owned by the deployment multisig. OpenZeppelin's Transparent Proxy design keeps upgrade authority separate from implementation calls; the proxy admin should not be used as the implementation caller. 

## Economic rules

- Initial minimum stake: **250,000 MGS**.
- Initial minimum MG claim: **25,000 MG**.
- Both thresholds are on-chain governance-controlled values; the frontend must read them from the staking proxy rather than permanently hardcoding them.
- Approved principal is not withdrawable.
- Rejected pending principal is refunded.
- Approved stake receives a base MG entitlement exactly equal to the MGS principal: `1 MGS -> 1 MG`.
- ROI is additional to the 1:1 base entitlement.
- ROI uses `86,400` seconds as one day.
- If ROI changes from 1% to 2%, the time before the change remains at 1% and only time after the checkpoint uses 2%.
- The frontend does not impose or display a separate income cap.

## Deployment order

1. Deploy governance/multisig.
2. Deploy `MGToken` and `MGSToken` with governance as token admin.
3. Deploy `MintGrowControllerV2` implementation.
4. Deploy `MGStakingMinterV2` implementation.
5. Deploy `MintGrowStakingV2` implementation.
6. Deploy `MintGrowStakeDelegationV2` implementation.
7. Deploy the delegation proxy with the governance/multisig as `ProxyAdmin` owner and initialize it with the funded sponsor EOA, MGS token and staking proxy address.
8. Deploy the staking proxy with the governance/multisig as `ProxyAdmin` owner and initialize it with governance, MGS, MG, delegation proxy, staking minter and controller.
9. Configure `MGStakingMinterV2` to accept only the staking proxy.
10. Grant `MGToken.MINTER_ROLE` only to `MGStakingMinterV2`.
11. Verify proxy and implementation addresses and all initialization state.
12. Transfer all operational control to the production multisig.
13. Test delegation, pending stake, approve/reject, ROI checkpointing, minimum claim and pause paths on testnet.
14. Perform independent security review/audit before production deployment.

## Explicitly removed from V2

The following old architecture is **not part of the new staking flow**:

- `MGSStaking.withdraw()` / `withdrawFor()` principal withdrawal
- backend-created withdrawal payouts
- Paymaster sponsorship
- arbitrary delegated `execute()` calls
- arbitrary token approvals from the delegation account
- game balance as a source of on-chain staking principal
- backend/database state as proof that a stake exists

The blockchain staking proxy is the authoritative source of stake state.
