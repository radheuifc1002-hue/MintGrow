// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

interface IMGToken { function mint(address to, uint256 amount) external; }
interface IMintGrowController { function consumeStakingEmission(uint256 amount) external; }

contract MGStakingMinter is Initializable, UUPSUpgradeable, AccessControl {
    bytes32 public constant STAKING_ROLE = keccak256("STAKING_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    address public token;
    address public controller;

    error InvalidAddress();
    error Unauthorized();

    event RewardMinted(address indexed user, uint256 amount);
    event ControllerUpdated(address indexed controller);

    function initialize(address admin, address token_, address controller_) external initializer {
        if (admin == address(0) || token_ == address(0) || controller_ == address(0)) revert InvalidAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
        token = token_;
        controller = controller_;
    }

    function setController(address controller_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (controller_ == address(0)) revert InvalidAddress();
        controller = controller_;
        emit ControllerUpdated(controller_);
    }

    function mintReward(address to, uint256 amount) external onlyRole(STAKING_ROLE) {
        IMintGrowController(controller).consumeStakingEmission(amount);
        IMGToken(token).mint(to, amount);
        emit RewardMinted(to, amount);
    }

    function _authorizeUpgrade(address) internal override onlyRole(UPGRADER_ROLE) {}
}
