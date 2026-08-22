// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MintGrowController {
    address public owner;
    uint256 public minRoiBps; uint256 public maxRoiBps; uint256 public stakingRoiBps;
    uint256 public epochEmissionLimit; bool public active = true;
    error NotOwner(); error InvalidRange(); error RoiOutOfRange(); error InvalidAddress();
    event RoiBoundsUpdated(uint256 minRoiBps, uint256 maxRoiBps);
    event StakingRoiUpdated(uint256 roiBps); event EpochEmissionLimitUpdated(uint256 limit);
    event ActiveUpdated(bool active); event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);
    constructor(address owner_, uint256 minRoiBps_, uint256 maxRoiBps_, uint256 initialRoiBps_, uint256 epochEmissionLimit_) {
        if (owner_ == address(0)) revert InvalidAddress(); if (minRoiBps_ > maxRoiBps_) revert InvalidRange();
        if (initialRoiBps_ < minRoiBps_ || initialRoiBps_ > maxRoiBps_) revert RoiOutOfRange();
        owner=owner_; minRoiBps=minRoiBps_; maxRoiBps=maxRoiBps_; stakingRoiBps=initialRoiBps_; epochEmissionLimit=epochEmissionLimit_;
        emit OwnershipTransferred(address(0), owner_);
    }
    modifier onlyOwner(){if(msg.sender!=owner)revert NotOwner();_;}
    function setRoiBounds(uint256 minBps,uint256 maxBps) external onlyOwner {if(minBps>maxBps||stakingRoiBps<minBps||stakingRoiBps>maxBps)revert InvalidRange();minRoiBps=minBps;maxRoiBps=maxBps;emit RoiBoundsUpdated(minBps,maxBps);}
    function setStakingRoi(uint256 roiBps) external onlyOwner {if(roiBps<minRoiBps||roiBps>maxRoiBps)revert RoiOutOfRange();stakingRoiBps=roiBps;emit StakingRoiUpdated(roiBps);}
    function setEpochEmissionLimit(uint256 limit) external onlyOwner {epochEmissionLimit=limit;emit EpochEmissionLimitUpdated(limit);}
    function setActive(bool active_) external onlyOwner {active=active_;emit ActiveUpdated(active_);}
    function transferOwnership(address newOwner) external onlyOwner {if(newOwner==address(0))revert InvalidAddress();emit OwnershipTransferred(owner,newOwner);owner=newOwner;}
}
