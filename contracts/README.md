# MintGrow on-chain architecture

This directory contains the production-oriented contract architecture for the MintGrow ecosystem. The contracts are **not audited and must not be treated as mainnet-certified** until compilation, invariant/fuzz testing, deployment rehearsal, formal review where appropriate, and an independent security audit are complete.

## Token layer

- `MGToken.sol` — normal, non-upgradeable ERC-20. Minting is role-gated. Burn, pause, blacklist and EIP-2612 permit are included.
- `MGSToken.sol` — normal, non-upgradeable ERC-20 with the same operational controls.

## Minting layer

- `MGStakingMinter` — UUPS implementation. It can only mint MG for staking rewards and consumes the controller's staking emission budget first.
- `MGProjectMinter` — UUPS implementation with per-project mint allowances.
- `MGSDistributionMinter` — UUPS implementation with an epoch emission ceiling.
- `MGStakingMinterProxy`, `MGProjectMinterProxy`, `MGSDistributionMinterProxy` — OpenZeppelin Transparent Upgradeable Proxy targets. Each proxy gets its own `ProxyAdmin`; transfer that admin's ownership to governance before production.

OpenZeppelin recommends careful governance and upgrade-key management for upgradeable contracts. The proxy address remains stable while implementations can be upgraded through the dedicated `ProxyAdmin`.

## Economy

- `MintGrowController` — bounded ROI and daily staking emission policy.
- `MGSStaking` — configurable minimum stake, initially `250,000 MGS`; wallet allowlist; direct staking; delegated `stakeFor`, `claimRewardFor` and `withdrawFor`.
- `MintGrowDelegationRegistry` — EIP-712 constrained delegation with expiry, nonce and maximum delegated amount.
- `MintGrowWithdrawalManager` — EIP-712 withdrawal authorization with replay protection and treasury allowance separation.

## Sponsored account abstraction

- `MintGrow7702Account` — constrained ERC-4337 account logic suitable for an EIP-7702 delegation target. It only permits calls to the configured MGS token, staking contract and withdrawal manager, and rejects arbitrary value transfers.
- `MintGrowDelegationProxy` — OpenZeppelin Transparent Proxy that can be used as the stable delegated implementation target for testing. Its `ProxyAdmin` owner must be governance.
- `MintGrowPaymaster` — ERC-4337 paymaster with sender allowlisting and per-sender sponsorship budgets.

The website keeps bundler/paymaster credentials server-side. The Mini App should only collect wallet signatures and send signed authorization material to the MintGrow backend.

## Deployment order

1. Deploy governance/multisig.
2. Deploy `MGToken` and `MGSToken` with governance as default admin.
3. Deploy `MintGrowController`.
4. Deploy `MintGrowDelegationRegistry`.
5. Deploy `MGStakingMinter` implementation + proxy and initialize it.
6. Deploy `MGProjectMinter` implementation + proxy and initialize it.
7. Deploy `MGSDistributionMinter` implementation + proxy and initialize it.
8. Deploy `MGSStaking` using the MGS token, staking minter, controller and delegation registry.
9. Grant the exact token minter roles to the corresponding proxy addresses only.
10. Grant the staking minter role to the staking contract only.
11. Configure the allowlisted staking wallets.
12. Deploy the withdrawal manager and configure only the intended MG/MGS token addresses.
13. Deploy the delegated account implementation and the stable delegation proxy; keep the proxy admin under governance.
14. Deploy and fund the paymaster; configure sender sponsorship and strict gas budgets.
15. Transfer administrative ownership/roles to the production governance structure.
16. Verify every implementation and proxy on the relevant explorer.

## Telegram Mini App flow

```text
Telegram Mini App
  -> Connect external EVM wallet
  -> Sign EIP-712 constrained delegation
  -> Sign MGS permit
  -> Backend prepares ERC-4337 UserOperation
  -> Paymaster sponsors gas
  -> EntryPoint
  -> Delegated account
  -> MGSStaking.stakeFor(owner, amount)
```

The current web UI is intentionally optimized for the existing MintGrow white/green Telegram Mini App theme and uses the configured `250,000 MGS` minimum.

## Required production checks

- Compile with the exact pinned OpenZeppelin version used for deployment.
- Run unit, integration, fuzz and invariant tests.
- Validate proxy storage layouts before every upgrade.
- Test blacklist/pause/emergency paths.
- Test delegation expiry, nonce reuse and maximum amount enforcement.
- Test ERC-1271 authorizers if governance is a contract wallet.
- Test EntryPoint/paymaster compatibility on the selected chain.
- Run a full testnet deployment and withdrawal rehearsal.
- Perform independent security review/audit before mainnet.
