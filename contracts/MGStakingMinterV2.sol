// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IMGTokenV2 { function mint(address to,uint256 amount) external; }

/// @notice Narrow, non-upgradeable MG reward mint gateway. Only the staking proxy may mint.
contract MGStakingMinterV2 {
    address public admin; address public token; address public staking; bool public paused;
    error InvalidAddress(); error Unauthorized(); error Paused(); error ZeroAmount();
    event RewardMinted(address indexed user,uint256 amount); event StakingUpdated(address indexed staking); event PausedUpdated(bool paused); event AdminTransferred(address indexed previousAdmin,address indexed newAdmin);
    modifier onlyAdmin(){if(msg.sender!=admin)revert Unauthorized();_;} modifier onlyStaking(){if(msg.sender!=staking)revert Unauthorized();_;}
    constructor(address admin_,address token_,address staking_){if(admin_==address(0)||token_==address(0)||staking_==address(0))revert InvalidAddress();admin=admin_;token=token_;staking=staking_;}
    function mintReward(address to,uint256 amount) external onlyStaking{if(paused)revert Paused();if(to==address(0)||amount==0)revert ZeroAmount();IMGTokenV2(token).mint(to,amount);emit RewardMinted(to,amount);}
    function setStaking(address staking_) external onlyAdmin{if(staking_==address(0))revert InvalidAddress();staking=staking_;emit StakingUpdated(staking_);} function setPaused(bool paused_) external onlyAdmin{paused=paused_;emit PausedUpdated(paused_);} function transferAdmin(address newAdmin) external onlyAdmin{if(newAdmin==address(0))revert InvalidAddress();emit AdminTransferred(admin,newAdmin);admin=newAdmin;}
}
