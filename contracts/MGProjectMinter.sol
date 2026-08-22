// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

interface IMGProjectToken { function mint(address to, uint256 amount) external; }

contract MGProjectMinter is Initializable, UUPSUpgradeable, AccessControl {
    bytes32 public constant PROJECT_ROLE = keccak256("PROJECT_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    address public token;
    mapping(address => uint256) public remainingAllowance;

    error InvalidAddress();
    error ExceedsAllowance();

    event ProjectAllowanceUpdated(address indexed project, uint256 allowance);
    event ProjectMinted(address indexed project, address indexed to, uint256 amount);

    function initialize(address admin, address token_) external initializer {
        if (admin == address(0) || token_ == address(0)) revert InvalidAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
        token = token_;
    }

    function setProjectAllowance(address project, uint256 allowance) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (project == address(0)) revert InvalidAddress();
        remainingAllowance[project] = allowance;
        emit ProjectAllowanceUpdated(project, allowance);
    }

    function mintForProject(address to, uint256 amount) external onlyRole(PROJECT_ROLE) {
        if (amount > remainingAllowance[msg.sender]) revert ExceedsAllowance();
        unchecked { remainingAllowance[msg.sender] -= amount; }
        IMGProjectToken(token).mint(to, amount);
        emit ProjectMinted(msg.sender, to, amount);
    }

    function _authorizeUpgrade(address) internal override onlyRole(UPGRADER_ROLE) {}
}
