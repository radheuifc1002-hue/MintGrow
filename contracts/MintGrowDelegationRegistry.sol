// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {AccessControlDefaultAdminRules} from "@openzeppelin/contracts/access/extensions/AccessControlDefaultAdminRules.sol";

contract MintGrowDelegationRegistry is EIP712, AccessControlDefaultAdminRules {
    bytes32 public constant CONFIG_ROLE = keccak256("DELEGATION_CONFIG_ROLE");
    bytes32 private constant DELEGATION_TYPEHASH = keccak256(
        "Delegation(address owner,address delegate,uint256 nonce,uint256 expiry,uint256 maxAmount)"
    );

    struct Delegation {
        address delegate;
        uint256 expiry;
        uint256 maxAmount;
        uint256 spent;
        bool active;
    }

    mapping(address => uint256) public nonces;
    mapping(address => Delegation) public delegations;

    error InvalidAddress();
    error Expired();
    error InvalidSignature();
    error InvalidNonce();
    error NotDelegate();
    error LimitExceeded();

    event DelegationAuthorized(address indexed owner, address indexed delegate, uint256 expiry, uint256 maxAmount);
    event DelegationRevoked(address indexed owner, address indexed delegate);
    event DelegationSpent(address indexed owner, address indexed delegate, uint256 amount, uint256 spent);

    constructor(address admin, uint48 adminDelay)
        EIP712("MintGrow Delegation", "1")
        AccessControlDefaultAdminRules(adminDelay, admin)
    {
        if (admin == address(0)) revert InvalidAddress();
        _grantRole(CONFIG_ROLE, admin);
    }

    function digest(address owner, address delegate, uint256 nonce, uint256 expiry, uint256 maxAmount) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(DELEGATION_TYPEHASH, owner, delegate, nonce, expiry, maxAmount)));
    }

    function authorize(
        address owner,
        address delegate,
        uint256 expiry,
        uint256 maxAmount,
        bytes calldata signature
    ) external {
        if (owner == address(0) || delegate == address(0)) revert InvalidAddress();
        if (block.timestamp > expiry) revert Expired();
        uint256 nonce = nonces[owner];
        bytes32 typedDigest = digest(owner, delegate, nonce, expiry, maxAmount);
        if (!SignatureChecker.isValidSignatureNow(owner, typedDigest, signature)) revert InvalidSignature();
        unchecked { nonces[owner] = nonce + 1; }
        delegations[owner] = Delegation(delegate, expiry, maxAmount, 0, true);
        emit DelegationAuthorized(owner, delegate, expiry, maxAmount);
    }

    function revoke() external {
        Delegation storage d = delegations[msg.sender];
        d.active = false;
        emit DelegationRevoked(msg.sender, d.delegate);
    }

    function revokeBySignature(address owner, uint256 nonce, uint256 expiry, bytes calldata signature) external {
        bytes32 structHash = keccak256(abi.encode(DELEGATION_TYPEHASH, owner, address(0), nonce, expiry, 0));
        bytes32 typedDigest = _hashTypedDataV4(structHash);
        if (!SignatureChecker.isValidSignatureNow(owner, typedDigest, signature)) revert InvalidSignature();
        if (nonces[owner] != nonce) revert InvalidNonce();
        unchecked { nonces[owner] = nonce + 1; }
        address delegate = delegations[owner].delegate;
        delegations[owner].active = false;
        emit DelegationRevoked(owner, delegate);
    }

    function canAct(address owner, address delegate, uint256 amount) external view returns (bool) {
        Delegation memory d = delegations[owner];
        return d.active && d.delegate == delegate && block.timestamp <= d.expiry && d.spent + amount <= d.maxAmount;
    }

    function consume(address owner, address delegate, uint256 amount) external onlyRole(CONFIG_ROLE) {
        _consume(owner, delegate, amount);
    }

    function consumeByDelegate(address owner, uint256 amount) external {
        _consume(owner, msg.sender, amount);
    }

    function _consume(address owner, address delegate, uint256 amount) internal {
        Delegation storage d = delegations[owner];
        if (!d.active || d.delegate != delegate) revert NotDelegate();
        if (block.timestamp > d.expiry) revert Expired();
        if (amount > d.maxAmount - d.spent) revert LimitExceeded();
        d.spent += amount;
        emit DelegationSpent(owner, delegate, amount, d.spent);
    }
}
