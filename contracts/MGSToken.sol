// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Pausable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {AccessControlDefaultAdminRules} from "@openzeppelin/contracts/access/extensions/AccessControlDefaultAdminRules.sol";

contract MGSToken is ERC20, ERC20Burnable, ERC20Pausable, ERC20Permit, AccessControlDefaultAdminRules {
    bytes32 public constant MINTER_ROLE = keccak256("MGS_MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("MGS_PAUSER_ROLE");
    bytes32 public constant BLACKLISTER_ROLE = keccak256("MGS_BLACKLISTER_ROLE");

    mapping(address => bool) public blacklisted;
    error Blacklisted(address account);
    error ZeroAddress();
    event BlacklistedAddress(address indexed account);
    event UnblacklistedAddress(address indexed account);

    constructor(address admin, uint48 adminDelay)
        ERC20("Mint Grow Staking", "MGS")
        ERC20Permit("Mint Grow Staking")
        AccessControlDefaultAdminRules(adminDelay, admin)
    {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(BLACKLISTER_ROLE, admin);
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        if (blacklisted[to]) revert Blacklisted(to);
        _mint(to, amount);
    }

    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    function blacklist(address account) external onlyRole(BLACKLISTER_ROLE) {
        if (account == address(0)) revert ZeroAddress();
        blacklisted[account] = true;
        emit BlacklistedAddress(account);
    }

    function unblacklist(address account) external onlyRole(BLACKLISTER_ROLE) {
        blacklisted[account] = false;
        emit UnblacklistedAddress(account);
    }

    function _update(address from, address to, uint256 value)
        internal override(ERC20, ERC20Pausable)
    {
        if (from != address(0) && blacklisted[from]) revert Blacklisted(from);
        if (to != address(0) && blacklisted[to]) revert Blacklisted(to);
        super._update(from, to, value);
    }
}
