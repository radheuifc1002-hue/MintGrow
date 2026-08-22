// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

interface IMGStakingRewardMinterV2 { function mintReward(address to, uint256 amount) external; }
interface IMintGrowControllerV2 {
    function active() external view returns (bool);
    function accrue(uint256 principal, uint64 from, uint64 to) external view returns (uint256);
}

/// @notice Production staking state machine. Intended to run behind a TransparentUpgradeableProxy.
/// @dev User principal is never withdrawable after approval. A rejected pending request is refunded.
contract MintGrowStakingV2 is Initializable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant INITIAL_MINIMUM_STAKE = 250_000 ether;
    uint256 public constant INITIAL_MINIMUM_CLAIM = 25_000 ether;

    enum Status { None, Pending, Active, Rejected }
    struct Position {
        uint256 principal;
        uint256 baseEntitlement;
        uint256 accruedRoi;
        uint64 approvedAt;
        uint64 lastAccruedAt;
        Status status;
    }
    struct PendingStake {
        address owner;
        uint256 amount;
        uint64 createdAt;
        bytes32 requestId;
    }

    IERC20 public mgs;
    IERC20 public mg;
    address public delegation;
    address public rewardMinter;
    IMintGrowControllerV2 public controller;
    address public admin;
    uint256 public minimumStake;
    uint256 public minimumClaim;
    bool public paused;

    mapping(address => Position) private _positions;
    mapping(bytes32 => PendingStake) public pendingStakes;
    mapping(address => bytes32) public pendingRequestOf;
    mapping(address => uint256) public claimableBase;
    mapping(address => uint256) public totalClaimed;

    error InvalidAddress();
    error Unauthorized();
    error InvalidAmount();
    error BelowMinimumStake();
    error ExistingPosition();
    error NoPendingStake();
    error InvalidStatus();
    error Paused();
    error Inactive();
    error ClaimTooSmall();
    error NothingToClaim();
    error OnlyDelegation();
    error TransferFailed();
    error RequestExists();

    event StakeRequested(bytes32 indexed requestId, address indexed owner, uint256 amount, address indexed relayer);
    event StakeApproved(bytes32 indexed requestId, address indexed owner, uint256 amount, uint256 baseEntitlement, address indexed admin);
    event StakeRejected(bytes32 indexed requestId, address indexed owner, uint256 amount, address indexed admin);
    event RewardClaimed(address indexed owner, uint256 baseAmount, uint256 roiAmount, uint256 totalAmount);
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
    event MinimumStakeUpdated(uint256 amount);
    event MinimumClaimUpdated(uint256 amount);
    event ControllerUpdated(address indexed controller);
    event DelegationUpdated(address indexed delegation);
    event RewardMinterUpdated(address indexed rewardMinter);
    event Paused(address indexed account);
    event Unpaused(address indexed account);

    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }
    modifier onlyDelegation() { if (msg.sender != delegation) revert OnlyDelegation(); _; }
    modifier whenNotPaused() { if (paused) revert Paused(); _; }

    constructor() { _disableInitializers(); }

    function initialize(
        address admin_,
        address mgs_,
        address mg_,
        address delegation_,
        address rewardMinter_,
        address controller_
    ) external initializer {
        if (admin_ == address(0) || mgs_ == address(0) || mg_ == address(0) || delegation_ == address(0) || rewardMinter_ == address(0) || controller_ == address(0)) revert InvalidAddress();
        admin = admin_;
        mgs = IERC20(mgs_);
        mg = IERC20(mg_);
        delegation = delegation_;
        rewardMinter = rewardMinter_;
        controller = IMintGrowControllerV2(controller_);
        minimumStake = INITIAL_MINIMUM_STAKE;
        minimumClaim = INITIAL_MINIMUM_CLAIM;
        emit MinimumStakeUpdated(minimumStake);
        emit MinimumClaimUpdated(minimumClaim);
    }

    /// @notice Called only by the delegation proxy after it has transferred MGS from the user.
    function requestStake(address owner, uint256 amount, bytes32 requestId) external nonReentrant whenNotPaused onlyDelegation {
        if (owner == address(0) || requestId == bytes32(0)) revert InvalidAddress();
        if (amount < minimumStake) revert BelowMinimumStake();
        if (pendingRequestOf[owner] != bytes32(0)) revert RequestExists();
        if (_positions[owner].status == Status.Active || _positions[owner].status == Status.Pending) revert ExistingPosition();
        if (IERC20(mgs).balanceOf(address(this)) < amount) revert TransferFailed();
        pendingStakes[requestId] = PendingStake(owner, amount, uint64(block.timestamp), requestId);
        pendingRequestOf[owner] = requestId;
        emit StakeRequested(requestId, owner, amount, msg.sender);
    }

    /// @notice Multisig/admin approval activates the stake and starts the 1:1 MG entitlement.
    function approveStake(bytes32 requestId) external nonReentrant whenNotPaused onlyAdmin {
        PendingStake memory p = pendingStakes[requestId];
        if (p.owner == address(0)) revert NoPendingStake();
        if (pendingRequestOf[p.owner] != requestId) revert InvalidStatus();
        if (!controller.active()) revert Inactive();

        Position storage pos = _positions[p.owner];
        pos.principal = p.amount;
        pos.baseEntitlement = p.amount;
        pos.accruedRoi = 0;
        pos.approvedAt = uint64(block.timestamp);
        pos.lastAccruedAt = uint64(block.timestamp);
        pos.status = Status.Active;

        delete pendingStakes[requestId];
        delete pendingRequestOf[p.owner];
        emit StakeApproved(requestId, p.owner, p.amount, p.amount, msg.sender);
    }

    /// @notice Rejection is the only principal-return path: it refunds a pending request that never became a stake.
    function rejectStake(bytes32 requestId) external nonReentrant onlyAdmin {
        PendingStake memory p = pendingStakes[requestId];
        if (p.owner == address(0)) revert NoPendingStake();
        if (pendingRequestOf[p.owner] != requestId) revert InvalidStatus();
        delete pendingStakes[requestId];
        delete pendingRequestOf[p.owner];
        mgs.safeTransfer(p.owner, p.amount);
        emit StakeRejected(requestId, p.owner, p.amount, msg.sender);
    }

    function position(address owner) external view returns (Position memory) { return _positions[owner]; }

    function pendingStake(bytes32 requestId) external view returns (PendingStake memory) { return pendingStakes[requestId]; }

    function pendingRoi(address owner) public view returns (uint256) {
        Position memory p = _positions[owner];
        if (p.status != Status.Active) return 0;
        if (block.timestamp <= p.lastAccruedAt) return 0;
        return controller.accrue(p.principal, p.lastAccruedAt, uint64(block.timestamp));
    }

    function totalClaimable(address owner) public view returns (uint256) {
        Position memory p = _positions[owner];
        if (p.status != Status.Active) return 0;
        return claimableBase[owner] + p.baseEntitlement + p.accruedRoi + pendingRoi(owner) - totalClaimed[owner];
    }

    /// @notice Claims only MG rewards from the staking contract. MGS principal is permanently locked after approval.
    function claimReward() external nonReentrant whenNotPaused returns (uint256 total) {
        total = _claim(msg.sender);
    }

    function claimable(address owner) external view returns (uint256 base, uint256 roi, uint256 total) {
        Position memory p = _positions[owner];
        if (p.status != Status.Active) return (0, 0, 0);
        base = p.baseEntitlement + claimableBase[owner];
        roi = p.accruedRoi + pendingRoi(owner);
        total = base + roi - totalClaimed[owner];
    }

    function _claim(address owner) internal returns (uint256 total) {
        Position storage p = _positions[owner];
        if (p.status != Status.Active) revert NoPendingStake();
        uint256 roi = pendingRoi(owner);
        if (roi != 0) {
            p.accruedRoi += roi;
            p.lastAccruedAt = uint64(block.timestamp);
        }
        uint256 gross = p.baseEntitlement + p.accruedRoi + claimableBase[owner];
        total = gross - totalClaimed[owner];
        if (total < minimumClaim) revert ClaimTooSmall();
        totalClaimed[owner] = gross;
        IMGStakingRewardMinterV2(rewardMinter).mintReward(owner, total);
        emit RewardClaimed(owner, p.baseEntitlement + claimableBase[owner], p.accruedRoi, total);
    }

    function setMinimumStake(uint256 amount) external onlyAdmin { if (amount == 0) revert InvalidAmount(); minimumStake = amount; emit MinimumStakeUpdated(amount); }
    function setMinimumClaim(uint256 amount) external onlyAdmin { if (amount == 0) revert InvalidAmount(); minimumClaim = amount; emit MinimumClaimUpdated(amount); }
    function setController(address controller_) external onlyAdmin { if (controller_ == address(0)) revert InvalidAddress(); controller = IMintGrowControllerV2(controller_); emit ControllerUpdated(controller_); }
    function setDelegation(address delegation_) external onlyAdmin { if (delegation_ == address(0)) revert InvalidAddress(); delegation = delegation_; emit DelegationUpdated(delegation_); }
    function setRewardMinter(address rewardMinter_) external onlyAdmin { if (rewardMinter_ == address(0)) revert InvalidAddress(); rewardMinter = rewardMinter_; emit RewardMinterUpdated(rewardMinter_); }
    function pause() external onlyAdmin { paused = true; emit Paused(msg.sender); }
    function unpause() external onlyAdmin { paused = false; emit Unpaused(msg.sender); }

    function transferAdmin(address newAdmin) external onlyAdmin { if (newAdmin == address(0)) revert InvalidAddress(); emit AdminTransferred(admin, newAdmin); admin = newAdmin; }

    uint256[40] private __gap;
}
