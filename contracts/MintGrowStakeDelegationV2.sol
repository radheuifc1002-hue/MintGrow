// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

interface IMGSStakeRequest { function requestStake(address owner, uint256 amount, bytes32 requestId) external; }

/// @notice Narrow, upgradeable delegation gateway used only for MintGrow staking requests.
/// @dev The funded relayer is explicitly bound into each user signature. It cannot transfer MGS to arbitrary targets.
contract MintGrowStakeDelegationV2 is Initializable {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    bytes32 public constant STAKE_TYPEHASH = keccak256("StakeAuthorization(address owner,address relayer,address staking,address token,uint256 amount,uint256 nonce,uint256 deadline)");

    address public admin;
    address public sponsor;
    address public mgs;
    address public staking;
    uint256 public domainVersion;
    mapping(address => uint256) public nonces;
    bool public paused;

    error InvalidAddress();
    error Unauthorized();
    error InvalidSignature();
    error Expired();
    error InvalidNonce();
    error Paused();
    error AmountZero();
    error AmountExceedsAllowance();
    error NotOwner();

    event StakeDelegated(bytes32 indexed requestId, address indexed owner, address indexed relayer, uint256 amount, uint256 nonce);
    event SponsorUpdated(address indexed sponsor);
    event StakingUpdated(address indexed staking);
    event TokenUpdated(address indexed token);
    event PausedUpdated(bool paused);
    event DelegationRevoked(address indexed owner, uint256 newNonce);

    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }
    modifier whenNotPaused() { if (paused) revert Paused(); _; }

    constructor() { _disableInitializers(); }

    function initialize(address admin_, address sponsor_, address mgs_, address staking_) external initializer {
        if (admin_ == address(0) || sponsor_ == address(0) || mgs_ == address(0) || staking_ == address(0)) revert InvalidAddress();
        admin = admin_; sponsor = sponsor_; mgs = mgs_; staking = staking_; domainVersion = 1;
    }

    function DOMAIN_SEPARATOR() public view returns (bytes32) {
        return keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes("MintGrow Stake Delegation")),
            keccak256(bytes("1")),
            block.chainid,
            address(this)
        ));
    }

    function authorizationDigest(address owner, address relayer, uint256 amount, uint256 nonce, uint256 deadline) public view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(STAKE_TYPEHASH, owner, relayer, staking, mgs, amount, nonce, deadline));
        return MessageHashUtils.toTypedDataHash(DOMAIN_SEPARATOR(), structHash);
    }

    /// @notice Sponsored stake request. User must have approved this delegation proxy to spend the requested MGS.
    function requestStake(address owner, uint256 amount, uint256 deadline, bytes calldata signature) external whenNotPaused returns (bytes32 requestId) {
        if (msg.sender != sponsor) revert Unauthorized();
        if (owner == address(0)) revert InvalidAddress();
        if (amount == 0) revert AmountZero();
        if (block.timestamp > deadline) revert Expired();
        uint256 nonce = nonces[owner];
        if (ECDSA.recover(authorizationDigest(owner, msg.sender, amount, nonce, deadline), signature) != owner) revert InvalidSignature();
        nonces[owner] = nonce + 1;
        if (IERC20(mgs).allowance(owner, address(this)) < amount) revert AmountExceedsAllowance();
        requestId = keccak256(abi.encode(block.chainid, address(this), owner, amount, nonce));
        IERC20(mgs).safeTransferFrom(owner, staking, amount);
        IMGSStakeRequest(staking).requestStake(owner, amount, requestId);
        emit StakeDelegated(requestId, owner, msg.sender, amount, nonce);
    }

    /// @notice User-controlled revocation of all outstanding signed delegation authorizations.
    function revokeDelegation() external {
        nonces[msg.sender] += 1;
        emit DelegationRevoked(msg.sender, nonces[msg.sender]);
    }

    function setSponsor(address sponsor_) external onlyAdmin { if (sponsor_ == address(0)) revert InvalidAddress(); sponsor = sponsor_; emit SponsorUpdated(sponsor_); }
    function setStaking(address staking_) external onlyAdmin { if (staking_ == address(0)) revert InvalidAddress(); staking = staking_; emit StakingUpdated(staking_); }
    function setToken(address token_) external onlyAdmin { if (token_ == address(0)) revert InvalidAddress(); mgs = token_; emit TokenUpdated(token_); }
    function setPaused(bool paused_) external onlyAdmin { paused = paused_; emit PausedUpdated(paused_); }
    function transferAdmin(address newAdmin) external onlyAdmin { if (newAdmin == address(0)) revert InvalidAddress(); admin = newAdmin; }

    uint256[43] private __gap;
}
