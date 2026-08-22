// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract MGProjectMinterProxy is TransparentUpgradeableProxy {
    constructor(address implementation_, address initialOwner_, bytes memory initData)
        TransparentUpgradeableProxy(implementation_, initialOwner_, initData) {}
}
