// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal ERC-4337 account interface used by the MintGrow delegation scaffold.
interface IEntryPointLike {
    function depositTo(address account) external payable;
}

interface IAccountLike {
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData);
}

struct PackedUserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    uint256 accountGasLimits;
    uint256 preVerificationGas;
    uint256 gasFees;
    bytes paymasterAndData;
    bytes signature;
}

/// @title MintGrow Delegation Account Implementation
/// @notice TESTNET SCAFFOLD for an EIP-7702-style delegated EOA used as an ERC-4337 account.
/// @dev The delegated EOA remains the authority. The implementation does not contain an
/// arbitrary operator/delegator address and does not provide unrestricted third-party wallet access.
/// Production deployment requires a full ERC-4337/EIP-7702 audit and the exact EntryPoint version.
contract MintGrowDelegationAccount is IAccountLike {
    error NotEntryPoint();
    error InvalidSender();
    error InvalidSignature();
    error CallFailed();

    address public immutable entryPoint;

    constructor(address entryPoint_) {
        entryPoint = entryPoint_;
    }

    modifier onlyEntryPoint() {
        if (msg.sender != entryPoint) revert NotEntryPoint();
        _;
    }

    /// @dev For a delegated EOA, address(this) is the user's wallet address.
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external override onlyEntryPoint returns (uint256 validationData) {
        if (userOp.sender != address(this)) revert InvalidSender();

        // The EIP-7702 delegated EOA signs the UserOperation. Signature verification is
        // intentionally left as a small testnet primitive here; production should use
        // OpenZeppelin's audited ECDSA/EIP-7702 account implementation for the selected stack.
        address recovered = _recover(userOpHash, userOp.signature);
        if (recovered != address(this)) revert InvalidSignature();

        if (missingAccountFunds != 0) {
            (bool ok,) = payable(msg.sender).call{value: missingAccountFunds}("");
            if (!ok) revert CallFailed();
        }

        return 0;
    }

    /// @notice Executes one call after EntryPoint validation.
    /// @dev MintGrow's production version should restrict calls to an allowlisted selector/target set.
    function execute(address target, uint256 value, bytes calldata data) external onlyEntryPoint {
        (bool ok,) = target.call{value: value}(data);
        if (!ok) revert CallFailed();
    }

    receive() external payable {}

    function _recover(bytes32 digest, bytes calldata signature) internal pure returns (address) {
        if (signature.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (v < 27) v += 27;
        if (v != 27 && v != 28) return address(0);
        return ecrecover(digest, v, r, s);
    }
}
