// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControlDefaultAdminRules} from "@openzeppelin/contracts/access/extensions/AccessControlDefaultAdminRules.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract MintGrowWithdrawalManager is EIP712, ReentrancyGuard, AccessControlDefaultAdminRules {
    using SafeERC20 for IERC20;

    bytes32 public constant CONFIG_ROLE = keccak256("WITHDRAWAL_CONFIG_ROLE");
    bytes32 private constant WITHDRAWAL_TYPEHASH = keccak256(
        "Withdrawal(address user,address token,uint256 amount,uint256 nonce,uint256 deadline)"
    );

    mapping(address => bool) public allowedToken;
    mapping(address => uint256) public nonces;
    address public treasury;
    address public authorizer;

    error InvalidAddress();
    error InvalidToken();
    error Expired();
    error InvalidSignature();

    event TokenAllowed(address indexed token, bool allowed);
    event TreasuryUpdated(address indexed treasury);
    event AuthorizerUpdated(address indexed authorizer);
    event WithdrawalExecuted(address indexed user, address indexed token, uint256 amount, uint256 nonce);

    constructor(address admin, uint48 adminDelay, address treasury_, address authorizer_)
        EIP712("MintGrow Withdrawal", "1")
        AccessControlDefaultAdminRules(adminDelay, admin)
    {
        if (admin == address(0) || treasury_ == address(0) || authorizer_ == address(0)) revert InvalidAddress();
        treasury = treasury_;
        authorizer = authorizer_;
        _grantRole(CONFIG_ROLE, admin);
    }

    function setAllowedToken(address token, bool allowed) external onlyRole(CONFIG_ROLE) {
        if (token == address(0)) revert InvalidAddress();
        allowedToken[token] = allowed;
        emit TokenAllowed(token, allowed);
    }

    function setTreasury(address treasury_) external onlyRole(CONFIG_ROLE) {
        if (treasury_ == address(0)) revert InvalidAddress();
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    function setAuthorizer(address authorizer_) external onlyRole(CONFIG_ROLE) {
        if (authorizer_ == address(0)) revert InvalidAddress();
        authorizer = authorizer_;
        emit AuthorizerUpdated(authorizer_);
    }

    function digest(address user, address token, uint256 amount, uint256 nonce, uint256 deadline) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(WITHDRAWAL_TYPEHASH, user, token, amount, nonce, deadline)));
    }

    function withdraw(
        address token,
        uint256 amount,
        uint256 deadline,
        bytes calldata signature
    ) external nonReentrant {
        if (!allowedToken[token]) revert InvalidToken();
        if (block.timestamp > deadline) revert Expired();
        uint256 nonce = nonces[msg.sender];
        bytes32 typedDigest = digest(msg.sender, token, amount, nonce, deadline);
        if (!SignatureChecker.isValidSignatureNow(authorizer, typedDigest, signature)) revert InvalidSignature();
        unchecked { nonces[msg.sender] = nonce + 1; }
        IERC20(token).safeTransferFrom(treasury, msg.sender, amount);
        emit WithdrawalExecuted(msg.sender, token, amount, nonce);
    }
}
