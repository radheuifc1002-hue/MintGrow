// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

/// @notice Stable staking address. The ProxyAdmin created by this proxy is owned by the deployment multisig.
contract MintGrowStakingProxyV2 is TransparentUpgradeableProxy {
    constructor(address implementation_, address initialOwner_, bytes memory initData)
        TransparentUpgradeableProxy(implementation_, initialOwner_, initData)
    {}
}
