// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
interface IMintableToken { function mint(address to,uint256 amount) external; }
contract MGProjectMinterProxy {
    address public immutable token; address public owner; address public controller; mapping(address=>uint256) public projectAllowance;
    error NotOwner(); error InvalidAddress(); error UnauthorizedProject(); error ExceedsAllowance();
    event ProjectAllowanceUpdated(address indexed project,uint256 allowance); event ControllerUpdated(address indexed controller);
    event Minted(address indexed project,address indexed to,uint256 amount); event OwnershipTransferred(address indexed oldOwner,address indexed newOwner);
    constructor(address token_,address owner_){if(token_==address(0)||owner_==address(0))revert InvalidAddress();token=token_;owner=owner_;emit OwnershipTransferred(address(0),owner_);}
    modifier onlyOwner(){if(msg.sender!=owner)revert NotOwner();_;}
    function setController(address controller_) external onlyOwner {controller=controller_;emit ControllerUpdated(controller_);}
    function setProjectAllowance(address project,uint256 allowance) external onlyOwner {if(project==address(0))revert InvalidAddress();projectAllowance[project]=allowance;emit ProjectAllowanceUpdated(project,allowance);}
    function transferOwnership(address newOwner) external onlyOwner {if(newOwner==address(0))revert InvalidAddress();emit OwnershipTransferred(owner,newOwner);owner=newOwner;}
    function mintForProject(address to,uint256 amount) external {uint256 allowance=projectAllowance[msg.sender];if(allowance==0)revert UnauthorizedProject();if(amount>allowance)revert ExceedsAllowance();unchecked{projectAllowance[msg.sender]=allowance-amount;}IMintableToken(token).mint(to,amount);emit Minted(msg.sender,to,amount);}
}
