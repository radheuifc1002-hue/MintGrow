// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

/// @notice ROI policy with timestamp checkpoints. ROI is integrated at the exact 86,400-second day rate.
/// @dev Every rate change checkpoints the old rate. Historical accrual is never retroactively repriced.
contract MintGrowControllerV2 is Initializable {
    uint256 public constant BPS = 10_000;
    uint256 public constant SECONDS_PER_DAY = 86_400;

    struct RateCheckpoint { uint64 timestamp; uint256 roiBps; uint256 cumulativeRateSeconds; }

    address public admin;
    uint256 public minRoiBps;
    uint256 public maxRoiBps;
    uint256 public stakingRoiBps;
    bool public active;
    RateCheckpoint[] private _checkpoints;

    error InvalidAddress();
    error Unauthorized();
    error InvalidRange();
    error RoiOutOfRange();
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
        active = active_;
        _checkpoints.push(RateCheckpoint(uint64(block.timestamp), initialRoiBps_, 0));
    }

    function checkpointCount() external view returns (uint256) { return _checkpoints.length; }

    function checkpoint(uint256 index) external view returns (RateCheckpoint memory) { return _checkpoints[index]; }

    function _integralAt(uint64 timestamp) internal view returns (uint256) {
        uint256 len = _checkpoints.length;
        if (len == 0 || timestamp < _checkpoints[0].timestamp) revert InvalidTime();
        uint256 low = 0;
        uint256 high = len;
        while (low < high) {
            uint256 mid = (low + high) / 2;
            if (_checkpoints[mid].timestamp <= timestamp) low = mid + 1;
            else high = mid;
        }
        RateCheckpoint memory cp = _checkpoints[low - 1];
        return cp.cumulativeRateSeconds + cp.roiBps * (timestamp - cp.timestamp);
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
        uint256 cumulative = _integralAt(nowTs);
        uint256 old = stakingRoiBps;
        if (_checkpoints[_checkpoints.length - 1].timestamp == nowTs) {
            _checkpoints[_checkpoints.length - 1] = RateCheckpoint(nowTs, newRoiBps, cumulative);
        } else {
            _checkpoints.push(RateCheckpoint(nowTs, newRoiBps, cumulative));
        }
        stakingRoiBps = newRoiBps;
        emit StakingRoiUpdated(old, newRoiBps, nowTs);
    }

    function setActive(bool active_) external onlyAdmin { active = active_; emit ActiveUpdated(active_); }

    function transferAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert InvalidAddress();
        emit AdminTransferred(admin, newAdmin);
        admin = newAdmin;
    }

    uint256[39] private __gap;
}
