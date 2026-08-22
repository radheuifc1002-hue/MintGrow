// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
interface IMintableToken { function mint(address to,uint256 amount) external; }
contract MGStakingMinterProxy {
    address public immutable token; address public owner; address public staking; address public controller;
    uint256 public epochLimit; uint256 public mintedThisEpoch; uint256 public epochStart;
    error NotOwner(); error NotStaking(); error InvalidAddress(); error ExceedsEpochLimit();
    event StakingUpdated(address indexed staking); event ControllerUpdated(address indexed controller); event EpochLimitUpdated(uint256 limit);
    event Minted(address indexed to,uint256 amount); event OwnershipTransferred(address indexed oldOwner,address indexed newOwner);
    constructor(address token_,address owner_,uint256 epochLimit_){if(token_==address(0)||owner_==address(0))revert InvalidAddress();token=token_;owner=owner_;epochLimit=epochLimit_;epochStart=block.timestamp;emit OwnershipTransferred(address(0),owner_);}
    modifier onlyOwner(){if(msg.sender!=owner)revert NotOwner();_;} modifier onlyStaking(){if(msg.sender!=staking)revert NotStaking();_;}
    function setStaking(address staking_) external onlyOwner {if(staking_==address(0))revert InvalidAddress();staking=staking_;emit StakingUpdated(staking_);}
    function setController(address controller_) external onlyOwner {controller=controller_;emit ControllerUpdated(controller_);}
    function setEpochLimit(uint256 limit) external onlyOwner {epochLimit=limit;emit EpochLimitUpdated(limit);}
    function transferOwnership(address newOwner) external onlyOwner {if(newOwner==address(0))revert InvalidAddress();emit OwnershipTransferred(owner,newOwner);owner=newOwner;}
    function mintReward(address to,uint256 amount) external onlyStaking {if(block.timestamp>=epochStart+1 days){epochStart=block.timestamp;mintedThisEpoch=0;}if(mintedThisEpoch+amount>epochLimit)revert ExceedsEpochLimit();mintedThisEpoch+=amount;IMintableToken(token).mint(to,amount);emit Minted(to,amount);}
}
