// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

/// @notice ROI policy with timestamp checkpoints. ROI is integrated at the exact 86,400-second day rate.
/// @dev Changing the rate checkpoints the old rate; previously elapsed time is never repriced.
contract MintGrowControllerV2 is Initializable {
    uint256 public constant BPS = 10_000;
    uint256 public constant SECONDS_PER_DAY = 86_400;

    struct RateCheckpoint { uint64 timestamp; uint256 roiBps; uint256 cumulativeRateSeconds; }

    address public admin;
    uint256 public minRoiBps;
    uint256 public maxRoiBps;
    uint256 public stakingRoiBps;
    uint64 public rateSince;
    uint256 public cumulativeRateSeconds;
    bool public active;

    error InvalidAddress();
    error Unauthorized();
    error InvalidRange();
    error RoiOutOfRange();
    error Inactive();
    error InvalidTime();

    event RoiBoundsUpdated(uint256 minRoiBps, uint256 maxRoiBps);
    event StakingRoiUpdated(uint256 oldRoiBps, uint256 newRoiBps, uint256 effectiveAt);
    event ActiveUpdated(bool active);
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);

    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }

    constructor() { _disableInitializers(); }

    function initialize(address admin_, uint256 minRoiBps_, uint256 maxRoiBps_, uint256 initialRoiBps_, bool active_) external initializer {
        if (admin_ == address(0)) revert InvalidAddress();
        if (minRoiBps_ > maxRoiBps_) revert InvalidRange();
        if (initialRoiBps_ < minRoiBps_ || initialRoiBps_ > maxRoiBps_) revert RoiOutOfRange();
        admin = admin_;
        minRoiBps = minRoiBps_;
        maxRoiBps = maxRoiBps_;
        stakingRoiBps = initialRoiBps_;
        rateSince = uint64(block.timestamp);
        active = active_;
    }

    function _integralAt(uint64 timestamp) internal view returns (uint256) {
        if (timestamp < rateSince) revert InvalidTime();
        return cumulativeRateSeconds + stakingRoiBps * (timestamp - rateSince);
    }

    function accrue(uint256 principal, uint64 from, uint64 to) external view returns (uint256) {
        if (to < from) revert InvalidTime();
        if (principal == 0 || to == from) return 0;
        uint256 delta = _integralAt(to) - _integralAt(from);
        return (principal * delta) / (BPS * SECONDS_PER_DAY);
    }

    function currentIntegral() external view returns (uint256) { return _integralAt(uint64(block.timestamp)); }

    function setRoiBounds(uint256 minBps, uint256 maxBps) external onlyAdmin {
        if (minBps > maxBps || stakingRoiBps < minBps || stakingRoiBps > maxBps) revert InvalidRange();
        minRoiBps = minBps;
        maxRoiBps = maxBps;
        emit RoiBoundsUpdated(minBps, maxBps);
    }

    function setStakingRoi(uint256 newRoiBps) external onlyAdmin {
        if (newRoiBps < minRoiBps || newRoiBps > maxRoiBps) revert RoiOutOfRange();
        uint64 nowTs = uint64(block.timestamp);
        cumulativeRateSeconds = _integralAt(nowTs);
        uint256 old = stakingRoiBps;
        stakingRoiBps = newRoiBps;
        rateSince = nowTs;
        emit StakingRoiUpdated(old, newRoiBps, nowTs);
    }

    function setActive(bool active_) external onlyAdmin { active = active_; emit ActiveUpdated(active_); }

    function transferAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert InvalidAddress();
        emit AdminTransferred(admin, newAdmin);
        admin = newAdmin;
    }

    uint256[40] private __gap;
}
