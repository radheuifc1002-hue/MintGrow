// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
interface IMintGrowStakeV2 { function requestStake(address owner,uint256 amount,uint256 deadline,bytes32 voucherNonce,bytes calldata voucherSignature) external returns(bytes32); }
contract MintGrowStakeDelegationV2 is Initializable {
 using ECDSA for bytes32; using MessageHashUtils for bytes32;
 bytes32 public constant STAKE_TYPEHASH=keccak256("StakeAuthorization(address owner,address relayer,address staking,uint256 amount,uint256 nonce,uint256 deadline)");
 address public admin; address public sponsor; address public staking; uint256 public domainVersion; mapping(address=>uint256) public nonces; bool public paused;
 error InvalidAddress(); error Unauthorized(); error InvalidSignature(); error Expired(); error Paused(); error AmountZero();
 event StakeDelegated(bytes32 indexed requestId,address indexed owner,address indexed relayer,uint256 amount,uint256 nonce); event SponsorUpdated(address indexed sponsor); event StakingUpdated(address indexed staking); event PausedUpdated(bool paused); event DelegationRevoked(address indexed owner,uint256 newNonce);
 modifier onlyAdmin(){if(msg.sender!=admin)revert Unauthorized();_;} modifier whenNotPaused(){if(paused)revert Paused();_;}
 constructor(){_disableInitializers();}
 function initialize(address admin_,address sponsor_,address staking_) external initializer {if(admin_==address(0)||sponsor_==address(0)||staking_==address(0))revert InvalidAddress();admin=admin_;sponsor=sponsor_;staking=staking_;domainVersion=1;}
 function DOMAIN_SEPARATOR() public view returns(bytes32){return keccak256(abi.encode(keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),keccak256(bytes("MintGrow Stake Delegation")),keccak256(bytes("1")),block.chainid,address(this)));}
 function authorizationDigest(address owner,address relayer,uint256 amount,uint256 nonce,uint256 deadline) public view returns(bytes32){return MessageHashUtils.toTypedDataHash(DOMAIN_SEPARATOR(),keccak256(abi.encode(STAKE_TYPEHASH,owner,relayer,staking,amount,nonce,deadline)));}
 function requestStake(address owner,uint256 amount,uint256 deadline,bytes calldata signature,bytes32 voucherNonce,bytes calldata voucherSignature) external whenNotPaused returns(bytes32 requestId){if(msg.sender!=sponsor)revert Unauthorized();if(owner==address(0)||amount==0)revert AmountZero();if(block.timestamp>deadline)revert Expired();uint256 nonce=nonces[owner];if(ECDSA.recover(authorizationDigest(owner,msg.sender,amount,nonce,deadline),signature)!=owner)revert InvalidSignature();nonces[owner]=nonce+1;requestId=IMintGrowStakeV2(staking).requestStake(owner,amount,deadline,voucherNonce,voucherSignature);emit StakeDelegated(requestId,owner,msg.sender,amount,nonce);}
 function revokeDelegation() external {nonces[msg.sender]+=1;emit DelegationRevoked(msg.sender,nonces[msg.sender]);}
 function setSponsor(address v) external onlyAdmin {if(v==address(0))revert InvalidAddress();sponsor=v;emit SponsorUpdated(v);} function setStaking(address v) external onlyAdmin {if(v==address(0))revert InvalidAddress();staking=v;emit StakingUpdated(v);} function setPaused(bool v) external onlyAdmin {paused=v;emit PausedUpdated(v);} function transferAdmin(address v) external onlyAdmin {if(v==address(0))revert InvalidAddress();admin=v;}
 uint256[45] private __gap;
}