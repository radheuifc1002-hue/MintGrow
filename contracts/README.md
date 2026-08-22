# MintGrow on-chain contracts

Initial architecture for the MintGrow two-token ecosystem.

## Tokens

- `MGToken.sol` — fixed, non-upgradeable ERC-20 for the original MintGrow token.
- `MGSToken.sol` — fixed, non-upgradeable ERC-20 for Mint Grow Staking Token.

Both include burn, pause, and governance-controlled blacklist functionality. The token contracts themselves are **not proxies**.

## Mint gateways

- `MGStakingMinterProxy.sol` — only gateway intended to mint MG for staking rewards.
- `MGProjectMinterProxy.sol` — separate, allowance-based MG gateway for future MintGrow projects.
- `MGSDistributionMinterProxy.sol` — the single MGS distribution gateway.

These are permissioned minting gateways, not ERC-1967 upgradeable token proxies.

## Controller and staking

- `MintGrowController.sol` — bounded ROI and emission policy parameters.
- `MGSStaking.sol` — MGS staking, configurable minimum stake, and an explicit wallet allowlist. The initial minimum is **250,000 MGS** (18 decimals).

Only wallets explicitly allowed by governance can stake.

## Important status

This is an **initial architecture implementation, not a production deployment**. It has not been audited and should not be treated as safe for mainnet funds yet.

Before deployment, add a full test suite and harden:

1. Governance/timelock administration.
2. Controller-to-minter emission accounting.
3. Withdrawal/claim reentrancy protection and invariant tests.
4. ERC-4337 smart-account and paymaster integration.
5. WalletConnect/delegation integration off-chain.
6. Formal supply and ROI limits.
7. Deployment scripts and network configuration.
8. Independent security review/audit.
