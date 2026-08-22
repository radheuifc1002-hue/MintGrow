// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

interface IMGSToken { function mint(address to, uint256 amount) external; }

contract MGSDistributionMinter is Initializable, UUPSUpgradeable, AccessControl {
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    uint256 public epochLimit;
    uint256 public emittedThisEpoch;
    uint256 public epochStart;
    address public token;

    error InvalidAddress();
    error EmissionLimitExceeded();

    event DistributionMinted(address indexed distributor, address indexed to, uint256 amount);
    event EpochLimitUpdated(uint256 limit);

    function initialize(address admin, address token_, uint256 epochLimit_) external initializer {
        if (admin == address(0) || token_ == address(0)) revert InvalidAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
        token = token_;
        epochLimit = epochLimit_;
        epochStart = block.timestamp;
    }

    function setEpochLimit(uint256 limit) external onlyRole(DEFAULT_ADMIN_ROLE) {
        epochLimit = limit;
        emit EpochLimitUpdated(limit);
    }

    function distribute(address to, uint256 amount) external onlyRole(DISTRIBUTOR_ROLE) {
        if (block.timestamp >= epochStart + 1 days) {
            epochStart = block.timestamp;
            emittedThisEpoch = 0;
        }
        if (amount > epochLimit - emittedThisEpoch) revert EmissionLimitExceeded();
        emittedThisEpoch += amount;
        IMGSToken(token).mint(to, amount);
        emit DistributionMinted(msg.sender, to, amount);
    }

    function _authorizeUpgrade(address) internal override onlyRole(UPGRADER_ROLE) {}
}
