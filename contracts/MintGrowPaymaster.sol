// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControlDefaultAdminRules} from "@openzeppelin/contracts/access/extensions/AccessControlDefaultAdminRules.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

struct PackedUserOperationPaymaster {
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

enum PostOpMode { opSucceeded, opReverted, postOpReverted }

interface IEntryPointPaymaster {
    function depositTo(address account) external payable;
    function addStake(uint32 unstakeDelaySec) external payable;
    function unlockStake() external;
    function withdrawStake(address payable withdrawAddress) external;
    function withdrawTo(address payable withdrawAddress, uint256 amount) external;
}

interface IPaymasterLike {
    function validatePaymasterUserOp(
        PackedUserOperationPaymaster calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external returns (bytes memory context, uint256 validationData);
    function postOp(PostOpMode mode, bytes calldata context, uint256 actualGasCost, uint256 actualUserOpFeePerGas) external;
}

contract MintGrowPaymaster is AccessControlDefaultAdminRules, IPaymasterLike, ReentrancyGuard {
    bytes32 public constant OPERATOR_ROLE = keccak256("PAYMASTER_OPERATOR_ROLE");

    address public immutable entryPoint;
    mapping(address => bool) public sponsoredSender;
    mapping(address => uint256) public sponsoredGasBudget;
    uint256 public defaultGasBudget;

    error InvalidAddress();
    error NotEntryPoint();
    error SenderNotSponsored();
    error BudgetExceeded();

    event SenderSponsorshipUpdated(address indexed sender, bool allowed);
    event GasBudgetUpdated(address indexed sender, uint256 budget);
    event DefaultGasBudgetUpdated(uint256 budget);

    constructor(address admin, uint48 adminDelay, address entryPoint_, uint256 defaultGasBudget_)
        AccessControlDefaultAdminRules(adminDelay, admin)
    {
        if (admin == address(0) || entryPoint_ == address(0)) revert InvalidAddress();
        entryPoint = entryPoint_;
        defaultGasBudget = defaultGasBudget_;
        _grantRole(OPERATOR_ROLE, admin);
    }

    modifier onlyEntryPoint() {
        if (msg.sender != entryPoint) revert NotEntryPoint();
        _;
    }

    function setSponsoredSender(address sender, bool allowed) external onlyRole(OPERATOR_ROLE) {
        if (sender == address(0)) revert InvalidAddress();
        sponsoredSender[sender] = allowed;
        emit SenderSponsorshipUpdated(sender, allowed);
    }

    function setSenderGasBudget(address sender, uint256 budget) external onlyRole(OPERATOR_ROLE) {
        if (sender == address(0)) revert InvalidAddress();
        sponsoredGasBudget[sender] = budget;
        emit GasBudgetUpdated(sender, budget);
    }

    function setDefaultGasBudget(uint256 budget) external onlyRole(OPERATOR_ROLE) {
        defaultGasBudget = budget;
        emit DefaultGasBudgetUpdated(budget);
    }

    function validatePaymasterUserOp(
        PackedUserOperationPaymaster calldata userOp,
        bytes32,
        uint256 maxCost
    ) external override onlyEntryPoint returns (bytes memory context, uint256 validationData) {
        if (!sponsoredSender[userOp.sender]) revert SenderNotSponsored();
        uint256 budget = sponsoredGasBudget[userOp.sender];
        if (budget == 0) budget = defaultGasBudget;
        if (maxCost > budget) revert BudgetExceeded();
        context = abi.encode(userOp.sender, maxCost);
        validationData = 0;
    }

    function postOp(PostOpMode, bytes calldata context, uint256 actualGasCost, uint256) external override onlyEntryPoint {
        (address sender,) = abi.decode(context, (address, uint256));
        uint256 budget = sponsoredGasBudget[sender];
        if (budget == 0) budget = defaultGasBudget;
        if (actualGasCost > budget) revert BudgetExceeded();
    }

    function deposit() external payable onlyRole(OPERATOR_ROLE) {
        IEntryPointPaymaster(entryPoint).depositTo{value: msg.value}(address(this));
    }

    function addEntryPointStake(uint32 unstakeDelaySec) external payable onlyRole(OPERATOR_ROLE) {
        IEntryPointPaymaster(entryPoint).addStake{value: msg.value}(unstakeDelaySec);
    }

    function unlockEntryPointStake() external onlyRole(OPERATOR_ROLE) {
        IEntryPointPaymaster(entryPoint).unlockStake();
    }

    function withdrawEntryPointStake(address payable to) external onlyRole(OPERATOR_ROLE) {
        IEntryPointPaymaster(entryPoint).withdrawStake(to);
    }

    function withdrawEntryPointDeposit(address payable to, uint256 amount) external onlyRole(OPERATOR_ROLE) {
        IEntryPointPaymaster(entryPoint).withdrawTo(to, amount);
    }

    receive() external payable {}
}
