// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MintGrow Delegation Proxy (TESTNET SCAFFOLD)
/// @notice Experimental proxy slot for a constrained delegation implementation.
/// @dev This contract deliberately does NOT grant arbitrary wallet control and is
/// not an ERC-4337 account or a production delegation mechanism yet.
contract MintGrowDelegationProxy {
    bytes32 internal constant IMPLEMENTATION_SLOT =
        bytes32(uint256(keccak256("mintgrow.delegation.implementation")) - 1);
    bytes32 internal constant ADMIN_SLOT =
        bytes32(uint256(keccak256("mintgrow.delegation.admin")) - 1);

    event Upgraded(address indexed implementation);
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);

    error NotAdmin();
    error InvalidImplementation();
    error DelegateCallFailed();

    constructor(address admin_, address implementation_) {
        if (admin_ == address(0) || implementation_ == address(0)) revert InvalidImplementation();
        _setAdmin(admin_);
        _setImplementation(implementation_);
    }

    modifier onlyAdmin() {
        if (msg.sender != _admin()) revert NotAdmin();
        _;
    }

    function implementation() external view returns (address) {
        return _implementation();
    }

    function admin() external view returns (address) {
        return _admin();
    }

    function upgradeTo(address newImplementation) external onlyAdmin {
        if (newImplementation == address(0) || newImplementation.code.length == 0) {
            revert InvalidImplementation();
        }
        _setImplementation(newImplementation);
        emit Upgraded(newImplementation);
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert InvalidImplementation();
        address previous = _admin();
        _setAdmin(newAdmin);
        emit AdminTransferred(previous, newAdmin);
    }

    fallback() external payable {
        address impl = _implementation();
        (bool ok, bytes memory data) = impl.delegatecall(msg.data);
        if (!ok) {
            if (data.length != 0) assembly { revert(add(data, 32), mload(data)) }
            revert DelegateCallFailed();
        }
        assembly {
            return(add(data, 32), mload(data))
        }
    }

    receive() external payable {}

    function _implementation() internal view returns (address value) {
        bytes32 slot = IMPLEMENTATION_SLOT;
        assembly { value := sload(slot) }
    }

    function _setImplementation(address value) internal {
        bytes32 slot = IMPLEMENTATION_SLOT;
        assembly { sstore(slot, value) }
    }

    function _admin() internal view returns (address value) {
        bytes32 slot = ADMIN_SLOT;
        assembly { value := sload(slot) }
    }

    function _setAdmin(address value) internal {
        bytes32 slot = ADMIN_SLOT;
        assembly { sstore(slot, value) }
    }
}
