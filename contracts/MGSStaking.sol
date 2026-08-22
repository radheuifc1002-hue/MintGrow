// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControlDefaultAdminRules} from "@openzeppelin/contracts/access/extensions/AccessControlDefaultAdminRules.sol";

interface IMGStakingRewardMinter { function mintReward(address to, uint256 amount) external; }
interface IMintGrowPolicy { function active() external view returns (bool); function rewardFor(uint256 principal, uint256 elapsed) external view returns (uint256); }
interface IDelegationRegistry { function canAct(address owner, address delegate, uint256 amount) external view returns (bool); function consumeByDelegate(address owner, uint256 amount) external; }

contract MGSStaking is ReentrancyGuard, AccessControlDefaultAdminRules {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("STAKING_OPERATOR_ROLE");
    uint256 public constant INITIAL_MINIMUM_STAKE = 250_000 ether;

    IERC20 public immutable mgs;
    address public immutable rewardMinter;
    address public immutable delegationRegistry;
    address public controller;
    uint256 public minimumStake;

    mapping(address => bool) public allowedWallet;
    mapping(address => uint256) public unclaimedRewards;

    struct Position { uint256 amount; uint64 startedAt; uint64 lastAccruedAt; }
    mapping(address => Position) public positions;

    error InvalidAddress();
    error NotAllowedWallet();
    error BelowMinimumStake();
    error AlreadyStaked();
    error NoStake();
    error Inactive();
    error ZeroAmount();
    error DelegationNotAuthorized();

    event WalletAllowed(address indexed wallet, bool allowed);
    event MinimumStakeUpdated(uint256 amount);
    event ControllerUpdated(address indexed controller);
    event Staked(address indexed wallet, address indexed operator, uint256 amount);
    event PrincipalWithdrawn(address indexed wallet, address indexed operator, uint256 amount, uint256 rewardAccrued);
    event RewardClaimed(address indexed wallet, address indexed operator, uint256 reward);

    constructor(
        address admin,
        uint48 adminDelay,
        address mgs_,
        address rewardMinter_,
        address controller_,
        address delegationRegistry_
    ) AccessControlDefaultAdminRules(adminDelay, admin) {
        if (admin == address(0) || mgs_ == address(0) || rewardMinter_ == address(0) || controller_ == address(0) || delegationRegistry_ == address(0)) revert InvalidAddress();
        mgs = IERC20(mgs_);
        rewardMinter = rewardMinter_;
        controller = controller_;
        delegationRegistry = delegationRegistry_;
        minimumStake = INITIAL_MINIMUM_STAKE;
        _grantRole(OPERATOR_ROLE, admin);
    }

    function setAllowedWallet(address wallet, bool allowed) external onlyRole(OPERATOR_ROLE) {
        if (wallet == address(0)) revert InvalidAddress();
        allowedWallet[wallet] = allowed;
        emit WalletAllowed(wallet, allowed);
    }

    function setMinimumStake(uint256 amount) external onlyRole(OPERATOR_ROLE) {
        if (amount == 0) revert ZeroAmount();
        minimumStake = amount;
        emit MinimumStakeUpdated(amount);
    }

    function setController(address controller_) external onlyRole(OPERATOR_ROLE) {
        if (controller_ == address(0)) revert InvalidAddress();
        controller = controller_;
        emit ControllerUpdated(controller_);
    }

    function stake(uint256 amount) external nonReentrant {
        _stake(msg.sender, msg.sender, amount, false);
    }

    function stakeFor(address owner, uint256 amount) external nonReentrant {
        if (!IDelegationRegistry(delegationRegistry).canAct(owner, msg.sender, amount)) revert DelegationNotAuthorized();
        IDelegationRegistry(delegationRegistry).consumeByDelegate(owner, amount);
        _stake(owner, msg.sender, amount, true);
    }

    function _stake(address owner, address operator, uint256 amount, bool) internal {
        if (!allowedWallet[owner]) revert NotAllowedWallet();
        if (amount < minimumStake) revert BelowMinimumStake();
        if (positions[owner].amount != 0) revert AlreadyStaked();
        if (!IMintGrowPolicy(controller).active()) revert Inactive();
        mgs.safeTransferFrom(owner, address(this), amount);
        uint64 nowTs = uint64(block.timestamp);
        positions[owner] = Position(amount, nowTs, nowTs);
        emit Staked(owner, operator, amount);
    }

    function pendingReward(address wallet) public view returns (uint256) {
        Position memory p = positions[wallet];
        if (p.amount == 0) return 0;
        return IMintGrowPolicy(controller).rewardFor(p.amount, block.timestamp - p.lastAccruedAt);
    }

    function totalClaimable(address wallet) public view returns (uint256) {
        return unclaimedRewards[wallet] + pendingReward(wallet);
    }

    function claimReward() external nonReentrant returns (uint256 reward) {
        reward = _claim(msg.sender, msg.sender);
    }

    function claimRewardFor(address owner) external nonReentrant returns (uint256 reward) {
        if (!IDelegationRegistry(delegationRegistry).canAct(owner, msg.sender, 0)) revert DelegationNotAuthorized();
        reward = _claim(owner, msg.sender);
    }

    function _claim(address owner, address operator) internal returns (uint256 reward) {
        reward = totalClaimable(owner);
        if (reward == 0) revert ZeroAmount();
        Position storage p = positions[owner];
        if (p.amount != 0) p.lastAccruedAt = uint64(block.timestamp);
        unclaimedRewards[owner] = 0;
        IMGStakingRewardMinter(rewardMinter).mintReward(owner, reward);
        emit RewardClaimed(owner, operator, reward);
    }

    function withdraw() external nonReentrant returns (uint256 principal, uint256 rewardAccrued) {
        (principal, rewardAccrued) = _withdraw(msg.sender, msg.sender);
    }

    function withdrawFor(address owner) external nonReentrant returns (uint256 principal, uint256 rewardAccrued) {
        if (!IDelegationRegistry(delegationRegistry).canAct(owner, msg.sender, 0)) revert DelegationNotAuthorized();
        (principal, rewardAccrued) = _withdraw(owner, msg.sender);
    }

    function _withdraw(address owner, address operator) internal returns (uint256 principal, uint256 rewardAccrued) {
        Position memory p = positions[owner];
        if (p.amount == 0) revert NoStake();
        principal = p.amount;
        rewardAccrued = pendingReward(owner);
        delete positions[owner];
        if (rewardAccrued != 0) unclaimedRewards[owner] += rewardAccrued;
        mgs.safeTransfer(owner, principal);
        emit PrincipalWithdrawn(owner, operator, principal, rewardAccrued);
    }
}
