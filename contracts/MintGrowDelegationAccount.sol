// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MintGrow7702Account} from "./MintGrow7702Account.sol";

/// @notice Backwards-compatible name for the production EIP-7702 account implementation.
contract MintGrowDelegationAccount is MintGrow7702Account {
    constructor(address entryPoint_) MintGrow7702Account(entryPoint_) {}
}
