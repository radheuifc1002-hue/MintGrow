// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

/// @notice Stable delegation target for EIP-7702. The proxy address can remain constant
/// while the delegated account implementation is upgraded by its dedicated ProxyAdmin.
/// @dev The ProxyAdmin owner must be a governance/multisig address, never an end-user wallet.
contract MintGrowDelegationProxy is TransparentUpgradeableProxy {
    constructor(address implementation_, address initialOwner_, bytes memory initData)
        TransparentUpgradeableProxy(implementation_, initialOwner_, initData)
    {}
}
