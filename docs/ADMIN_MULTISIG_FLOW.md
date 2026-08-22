# Admin multisig transaction flow

The staking contract `admin` must be the deployed governance/multisig address.

The Admin Panel must never hold a multisig private key.

## Required flow

```text
Admin Panel
  -> load verified pending stake
  -> inspect gameplay/referrals/earning snapshots
  -> connect an authorized multisig owner EOA
  -> prepare approveStake(bytes32 requestId)
  -> submit/propose that calldata to the multisig
  -> multisig owners approve according to threshold
  -> multisig executes transaction
  -> BNB receipt confirms StakeApproved
  -> backend marks request confirmed
```

For a Safe-style multisig, `eth_sendTransaction` with `from = Safe contract address` is not a valid way to execute the transaction. The connected EOA signs/proposes the Safe transaction; the Safe contract executes it after the configured threshold is satisfied.

The V2 contract intentionally keeps `admin` as the multisig and does not add a server-side bypass.

Until a Safe-compatible proposal/execution adapter is configured, the Admin Panel's transaction builder must be treated as an EOA-admin adapter only and must not be used against a Safe address. The deployment script nevertheless sets the staking/delegation/controller administration and ProxyAdmin ownership to the multisig address.
