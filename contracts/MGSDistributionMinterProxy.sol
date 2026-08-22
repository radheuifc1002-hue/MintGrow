// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
interface IMintableMGS { function mint(address to,uint256 amount) external; }
contract MGSDistributionMinterProxy {
    address public immutable token; address public owner; address public controller; uint256 public epochLimit; uint256 public mintedThisEpoch; uint256 public epochStart;
    mapping(address=>bool) public distributors;
    error NotOwner(); error NotDistributor(); error InvalidAddress(); error ExceedsEpochLimit();
    event DistributorUpdated(address indexed distributor,bool allowed); event ControllerUpdated(address indexed controller); event EpochLimitUpdated(uint256 limit);
    event Minted(address indexed distributor,address indexed to,uint256 amount); event OwnershipTransferred(address indexed oldOwner,address indexed newOwner);
    constructor(address token_,address owner_,uint256 epochLimit_){if(token_==address(0)||owner_==address(0))revert InvalidAddress();token=token_;owner=owner_;epochLimit=epochLimit_;epochStart=block.timestamp;emit OwnershipTransferred(address(0),owner_);}
    modifier onlyOwner(){if(msg.sender!=owner)revert NotOwner();_;} modifier onlyDistributor(){if(!distributors[msg.sender])revert NotDistributor();_;}
    function setDistributor(address account,bool allowed) external onlyOwner {if(account==address(0))revert InvalidAddress();distributors[account]=allowed;emit DistributorUpdated(account,allowed);}
    function setController(address controller_) external onlyOwner {controller=controller_;emit ControllerUpdated(controller_);}
    function setEpochLimit(uint256 limit) external onlyOwner {epochLimit=limit;emit EpochLimitUpdated(limit);}
    function transferOwnership(address newOwner) external onlyOwner {if(newOwner==address(0))revert InvalidAddress();emit OwnershipTransferred(owner,newOwner);owner=newOwner;}
    function distribute(address to,uint256 amount) external onlyDistributor {if(block.timestamp>=epochStart+1 days){epochStart=block.timestamp;mintedThisEpoch=0;}if(mintedThisEpoch+amount>epochLimit)revert ExceedsEpochLimit();mintedThisEpoch+=amount;IMintableMGS(token).mint(to,amount);emit Minted(msg.sender,to,amount);}
}
