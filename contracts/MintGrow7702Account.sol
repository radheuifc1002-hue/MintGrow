// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

struct PackedUserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    bytes32 accountGasLimits;
    uint256 preVerificationGas;
    bytes32 gasFees;
    bytes paymasterAndData;
    bytes signature;
}

interface IEntryPoint7702 {
    function senderCreator() external view returns (address);
}

interface IAccount7702 {
    function validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash, uint256 missingAccountFunds) external returns (uint256 validationData);
}

contract MintGrow7702Account is IAccount7702 {
    using ECDSA for bytes32;

    address public immutable entryPoint;
    address public mgsToken;
    address public staking;
    address public withdrawalManager;
    bool public initialized;

    bytes4 private constant APPROVE_SELECTOR = bytes4(keccak256("approve(address,uint256)"));
    bytes4 private constant PERMIT_SELECTOR = bytes4(keccak256("permit(address,address,uint256,uint256,uint8,bytes32,bytes32)"));
    bytes4 private constant STAKE_SELECTOR = bytes4(keccak256("stake(uint256)"));
    bytes4 private constant CLAIM_SELECTOR = bytes4(keccak256("claimReward()"));
    bytes4 private constant STAKING_WITHDRAW_SELECTOR = bytes4(keccak256("withdraw()"));
    bytes4 private constant GAME_WITHDRAW_SELECTOR = bytes4(keccak256("withdraw(address,uint256,uint256,bytes)"));

    error NotEntryPoint();
    error InvalidSender();
    error InvalidSignature();
    error AlreadyInitialized();
    error InvalidConfiguration();
    error UnauthorizedInitialization();
    error UnsupportedCall();
    error NonZeroValue();
    error CallFailed();

    struct Call {
        address target;
        uint256 value;
        bytes data;
    }

    constructor(address entryPoint_) {
        if (entryPoint_ == address(0)) revert InvalidConfiguration();
        entryPoint = entryPoint_;
    }

    modifier onlyEntryPoint() {
        if (msg.sender != entryPoint) revert NotEntryPoint();
        _;
    }

    function initialize(address mgsToken_, address staking_, address withdrawalManager_) external {
        if (msg.sender != IEntryPoint7702(entryPoint).senderCreator()) revert UnauthorizedInitialization();
        if (initialized) revert AlreadyInitialized();
        if (mgsToken_ == address(0) || staking_ == address(0) || withdrawalManager_ == address(0)) revert InvalidConfiguration();
        mgsToken = mgsToken_;
        staking = staking_;
        withdrawalManager = withdrawalManager_;
        initialized = true;
    }

    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external override onlyEntryPoint returns (uint256 validationData) {
        if (userOp.sender != address(this) || !initialized) revert InvalidSender();
        address signer = ECDSA.recover(userOpHash, userOp.signature);
        if (signer != address(this)) revert InvalidSignature();
        if (missingAccountFunds != 0) {
            (bool ok,) = payable(entryPoint).call{value: missingAccountFunds}("");
            if (!ok) revert CallFailed();
        }
        return 0;
    }

    function execute(address target, uint256 value, bytes calldata data) external onlyEntryPoint {
        _checkCall(target, value, data);
        (bool ok,) = target.call{value: value}(data);
        if (!ok) revert CallFailed();
    }

    function executeBatch(Call[] calldata calls) external onlyEntryPoint {
        for (uint256 i; i < calls.length; ++i) {
            _checkCall(calls[i].target, calls[i].value, calls[i].data);
            (bool ok,) = calls[i].target.call{value: calls[i].value}(calls[i].data);
            if (!ok) revert CallFailed();
        }
    }

    function _checkCall(address target, uint256 value, bytes calldata data) internal view {
        if (value != 0 || data.length < 4) revert NonZeroValue();
        bytes4 selector;
        assembly { selector := calldataload(data.offset) }

        if (target == mgsToken) {
            if (selector == APPROVE_SELECTOR) {
                (address spender,) = abi.decode(data[4:], (address, uint256));
                if (spender != staking) revert UnsupportedCall();
                return;
            }
            if (selector == PERMIT_SELECTOR) {
                (address owner, address spender, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) =
                    abi.decode(data[4:], (address, address, uint256, uint256, uint8, bytes32, bytes32));
                amount; deadline; v; r; s;
                if (owner != address(this) || spender != staking) revert UnsupportedCall();
                return;
            }
        }

        if (target == staking && (selector == STAKE_SELECTOR || selector == CLAIM_SELECTOR || selector == STAKING_WITHDRAW_SELECTOR)) return;
        if (target == withdrawalManager && selector == GAME_WITHDRAW_SELECTOR) return;
        revert UnsupportedCall();
    }

    receive() external payable {}
}
