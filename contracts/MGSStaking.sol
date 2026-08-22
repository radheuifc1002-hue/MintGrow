// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
interface IERC20Minimal {function transferFrom(address from,address to,uint256 amount) external returns(bool);function transfer(address to,uint256 amount) external returns(bool);}
interface IStakingMinter {function mintReward(address to,uint256 amount) external;}
interface IController {function stakingRoiBps() external view returns(uint256);function active() external view returns(bool);}
contract MGSStaking {
 uint256 public constant BPS=10000; uint256 public constant YEAR=365 days; uint256 public constant INITIAL_MIN_STAKE=250_000 ether;
 address public immutable mgs; address public immutable mgStakingMinter; address public controller; address public owner; uint256 public minimumStake=INITIAL_MIN_STAKE;
 mapping(address=>bool) public allowedWallet;
 struct Position{uint256 amount;uint256 startedAt;uint256 lastAccruedAt;} mapping(address=>Position) public positions;
 error NotOwner();error NotAllowedWallet();error BelowMinimumStake();error AlreadyStaked();error NoStake();error InvalidAddress();error ControllerInactive();error TransferFailed();
 event WalletAllowed(address indexed wallet,bool allowed);event MinimumStakeUpdated(uint256 amount);event ControllerUpdated(address indexed controller);event Staked(address indexed wallet,uint256 amount);event Withdrawn(address indexed wallet,uint256 principal,uint256 reward);event RewardClaimed(address indexed wallet,uint256 reward);event OwnershipTransferred(address indexed oldOwner,address indexed newOwner);
 constructor(address mgs_,address minter_,address controller_,address owner_){if(mgs_==address(0)||minter_==address(0)||controller_==address(0)||owner_==address(0))revert InvalidAddress();mgs=mgs_;mgStakingMinter=minter_;controller=controller_;owner=owner_;emit OwnershipTransferred(address(0),owner_);}
 modifier onlyOwner(){if(msg.sender!=owner)revert NotOwner();_;}
 function setAllowedWallet(address wallet,bool allowed) external onlyOwner{if(wallet==address(0))revert InvalidAddress();allowedWallet[wallet]=allowed;emit WalletAllowed(wallet,allowed);}
 function setMinimumStake(uint256 amount) external onlyOwner{if(amount==0)revert BelowMinimumStake();minimumStake=amount;emit MinimumStakeUpdated(amount);}
 function setController(address controller_) external onlyOwner{if(controller_==address(0))revert InvalidAddress();controller=controller_;emit ControllerUpdated(controller_);}
 function transferOwnership(address newOwner) external onlyOwner{if(newOwner==address(0))revert InvalidAddress();emit OwnershipTransferred(owner,newOwner);owner=newOwner;}
 function stake(uint256 amount) external{if(!allowedWallet[msg.sender])revert NotAllowedWallet();if(amount<minimumStake)revert BelowMinimumStake();if(positions[msg.sender].amount!=0)revert AlreadyStaked();if(!IController(controller).active())revert ControllerInactive();if(!IERC20Minimal(mgs).transferFrom(msg.sender,address(this),amount))revert TransferFailed();positions[msg.sender]=Position(amount,block.timestamp,block.timestamp);emit Staked(msg.sender,amount);}
 function pendingReward(address wallet) public view returns(uint256){Position memory p=positions[wallet];if(p.amount==0)return 0;uint256 elapsed=block.timestamp-p.lastAccruedAt;uint256 roiBps=IController(controller).stakingRoiBps();return(p.amount*roiBps*elapsed)/(BPS*YEAR);}
 function claimReward() external{Position storage p=positions[msg.sender];if(p.amount==0)revert NoStake();uint256 reward=pendingReward(msg.sender);p.lastAccruedAt=block.timestamp;if(reward!=0)IStakingMinter(mgStakingMinter).mintReward(msg.sender,reward);emit RewardClaimed(msg.sender,reward);}
 function withdraw() external{Position memory p=positions[msg.sender];if(p.amount==0)revert NoStake();uint256 reward=pendingReward(msg.sender);delete positions[msg.sender];if(reward!=0)IStakingMinter(mgStakingMinter).mintReward(msg.sender,reward);if(!IERC20Minimal(mgs).transfer(msg.sender,p.amount))revert TransferFailed();emit Withdrawn(msg.sender,p.amount,reward);}
}
