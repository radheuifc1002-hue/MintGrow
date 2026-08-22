// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControlDefaultAdminRules} from "@openzeppelin/contracts/access/extensions/AccessControlDefaultAdminRules.sol";

contract MintGrowController is AccessControlDefaultAdminRules {
    bytes32 public constant POLICY_ROLE = keccak256("POLICY_ROLE");
    bytes32 public constant STAKING_MINTER_ROLE = keccak256("STAKING_MINTER_ROLE");

    uint256 public constant BPS = 10_000;
    uint256 public constant YEAR = 365 days;

    uint256 public minRoiBps;
    uint256 public maxRoiBps;
    uint256 public stakingRoiBps;
    uint256 public epochEmissionLimit;
    uint256 public epochStart;
    uint256 public emittedThisEpoch;
    bool public active;

    error InvalidRange();
    error RoiOutOfRange();
    error EmissionLimitExceeded();
    error Inactive();

    event RoiBoundsUpdated(uint256 minRoiBps, uint256 maxRoiBps);
    event StakingRoiUpdated(uint256 roiBps);
    event EpochEmissionLimitUpdated(uint256 limit);
    event ActiveUpdated(bool active);
    event EmissionConsumed(uint256 amount, uint256 epochTotal);

    constructor(
        address admin,
        uint48 adminDelay,
        uint256 minRoiBps_,
        uint256 maxRoiBps_,
        uint256 initialRoiBps_,
        uint256 epochEmissionLimit_
    ) AccessControlDefaultAdminRules(adminDelay, admin) {
        if (admin == address(0) || minRoiBps_ > maxRoiBps_) revert InvalidRange();
        if (initialRoiBps_ < minRoiBps_ || initialRoiBps_ > maxRoiBps_) revert RoiOutOfRange();
        minRoiBps = minRoiBps_;
        maxRoiBps = maxRoiBps_;
        stakingRoiBps = initialRoiBps_;
        epochEmissionLimit = epochEmissionLimit_;
        epochStart = block.timestamp;
        active = true;
        _grantRole(POLICY_ROLE, admin);
    }

    function setRoiBounds(uint256 minBps, uint256 maxBps) external onlyRole(POLICY_ROLE) {
        if (minBps > maxBps || stakingRoiBps < minBps || stakingRoiBps > maxBps) revert InvalidRange();
        minRoiBps = minBps;
        maxRoiBps = maxBps;
        emit RoiBoundsUpdated(minBps, maxBps);
    }

    function setStakingRoi(uint256 roiBps) external onlyRole(POLICY_ROLE) {
        if (roiBps < minRoiBps || roiBps > maxRoiBps) revert RoiOutOfRange();
        stakingRoiBps = roiBps;
        emit StakingRoiUpdated(roiBps);
    }

    function setEpochEmissionLimit(uint256 limit) external onlyRole(POLICY_ROLE) {
        epochEmissionLimit = limit;
        emit EpochEmissionLimitUpdated(limit);
    }

    function setActive(bool active_) external onlyRole(POLICY_ROLE) {
        active = active_;
        emit ActiveUpdated(active_);
    }

    function consumeStakingEmission(uint256 amount) external onlyRole(STAKING_MINTER_ROLE) {
        if (!active) revert Inactive();
        if (block.timestamp >= epochStart + 1 days) {
            epochStart = block.timestamp;
            emittedThisEpoch = 0;
        }
        if (amount > epochEmissionLimit - emittedThisEpoch) revert EmissionLimitExceeded();
        emittedThisEpoch += amount;
        emit EmissionConsumed(amount, emittedThisEpoch);
    }

    function rewardFor(uint256 principal, uint256 elapsed) external view returns (uint256) {
        return (principal * stakingRoiBps * elapsed) / (BPS * YEAR);
    }
}
