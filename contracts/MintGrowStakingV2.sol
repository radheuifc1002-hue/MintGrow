// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IMGSTokenMint { function mint(address to,uint256 amount) external; function burn(uint256 amount) external; }
interface IMGStakingRewardMinterV2 { function mintReward(address to,uint256 amount) external; }
interface IMintGrowControllerV2 { function active() external view returns(bool); function accrue(uint256 principal,uint64 from,uint64 to) external view returns(uint256); }

/// @notice Stake-only MGS accounting. No user MGS transfer and no unstake/principal withdrawal.
/// MGS is minted directly to this contract when an authorized earning voucher is consumed.
contract MintGrowStakingV2 is Initializable {
    using ECDSA for bytes32; using MessageHashUtils for bytes32;
    uint256 public constant INITIAL_MINIMUM_STAKE=250_000 ether; uint256 public constant INITIAL_MINIMUM_CLAIM=25_000 ether;
    bytes32 public constant VOUCHER_TYPEHASH=keccak256("StakeEarningVoucher(address owner,uint256 amount,uint256 nonce,uint256 deadline,bytes32 voucherNonce)");
    enum Status{None,Pending,Active,Rejected}
    struct Position{uint256 principal;uint256 baseEntitlement;uint256 accruedRoi;uint64 approvedAt;uint64 lastAccruedAt;Status status;}
    struct PendingStake{address owner;uint256 amount;uint64 createdAt;bytes32 requestId;bytes32 voucherNonce;}
    IERC20 public mgs; address public mg; address public delegation; address public rewardMinter; IMintGrowControllerV2 public controller; address public admin; address public earningAttester;
    uint256 public minimumStake; uint256 public minimumClaim; bool public paused;
    mapping(address=>Position) private _positions; mapping(bytes32=>PendingStake) public pendingStakes; mapping(address=>bytes32) public pendingRequestOf; mapping(bytes32=>bool) public usedVoucher; mapping(address=>uint256) public totalClaimed;
    error InvalidAddress(); error Unauthorized(); error InvalidAmount(); error BelowMinimumStake(); error ExistingPosition(); error NoPendingStake(); error InvalidStatus(); error Paused(); error Inactive(); error ClaimTooSmall(); error OnlyDelegation(); error InvalidVoucher(); error VoucherUsed(); error Reentrancy(); error MintFailed();
    event StakeRequested(bytes32 indexed requestId,address indexed owner,uint256 amount,address indexed relayer); event StakeApproved(bytes32 indexed requestId,address indexed owner,uint256 amount,uint256 baseEntitlement,address indexed admin); event StakeRejected(bytes32 indexed requestId,address indexed owner,uint256 amount,address indexed admin); event RewardClaimed(address indexed owner,uint256 baseAmount,uint256 roiAmount,uint256 totalAmount); event MinimumStakeUpdated(uint256 amount); event MinimumClaimUpdated(uint256 amount); event EarningAttesterUpdated(address indexed attester); event AdminTransferred(address indexed previousAdmin,address indexed newAdmin); event Paused(address indexed account); event Unpaused(address indexed account);
    modifier onlyAdmin(){if(msg.sender!=admin)revert Unauthorized();_;} modifier onlyDelegation(){if(msg.sender!=delegation)revert OnlyDelegation();_;} modifier whenNotPaused(){if(paused)revert Paused();_;}
    uint256 private _lock=1; modifier nonReentrant(){if(_lock!=1)revert Reentrancy();_lock=2;_;_lock=1;}
    constructor(){_disableInitializers();}
    function initialize(address admin_,address mgs_,address mg_,address delegation_,address rewardMinter_,address controller_,address earningAttester_) external initializer {if(admin_==address(0)||mgs_==address(0)||mg_==address(0)||delegation_==address(0)||rewardMinter_==address(0)||controller_==address(0)||earningAttester_==address(0))revert InvalidAddress();admin=admin_;mgs=IERC20(mgs_);mg=mg_;delegation=delegation_;rewardMinter=rewardMinter_;controller=IMintGrowControllerV2(controller_);earningAttester=earningAttester_;minimumStake=INITIAL_MINIMUM_STAKE;minimumClaim=INITIAL_MINIMUM_CLAIM;}
    function DOMAIN_SEPARATOR() public view returns(bytes32){return keccak256(abi.encode(keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),keccak256(bytes("MintGrow Staking")),keccak256(bytes("1")),block.chainid,address(this)));}
    function voucherDigest(address owner,uint256 amount,uint256 nonce,uint256 deadline,bytes32 voucherNonce) public view returns(bytes32){return MessageHashUtils.toTypedDataHash(DOMAIN_SEPARATOR(),keccak256(abi.encode(VOUCHER_TYPEHASH,owner,amount,nonce,deadline,voucherNonce)));}
    /// @notice Called by the delegation proxy. No token transfer occurs. The staking contract mints MGS to itself.
    function requestStake(address owner,uint256 amount,uint256 deadline,bytes32 voucherNonce,bytes calldata voucherSignature) external nonReentrant whenNotPaused onlyDelegation returns(bytes32 requestId){
        if(owner==address(0)||amount<minimumStake)revert BelowMinimumStake(); if(block.timestamp>deadline)revert InvalidVoucher(); if(pendingRequestOf[owner]!=bytes32(0)||_positions[owner].status==Status.Active)revert ExistingPosition(); if(usedVoucher[voucherNonce])revert VoucherUsed();
        uint256 nonce=uint256(uint160(owner)) ^ amount ^ uint256(voucherNonce); // deterministic binding component; voucherNonce prevents replay
        if(ECDSA.recover(voucherDigest(owner,amount,nonce,deadline,voucherNonce),voucherSignature)!=earningAttester)revert InvalidVoucher(); usedVoucher[voucherNonce]=true;
        requestId=keccak256(abi.encode(block.chainid,address(this),owner,amount,voucherNonce)); if(requestId==bytes32(0))revert InvalidVoucher();
        IMGSTokenMint(address(mgs)).mint(address(this),amount);
        pendingStakes[requestId]=PendingStake(owner,amount,uint64(block.timestamp),requestId,voucherNonce); pendingRequestOf[owner]=requestId; emit StakeRequested(requestId,owner,amount,msg.sender);
    }
    function approveStake(bytes32 requestId) external nonReentrant whenNotPaused onlyAdmin {PendingStake memory p=pendingStakes[requestId];if(p.owner==address(0))revert NoPendingStake();if(pendingRequestOf[p.owner]!=requestId)revert InvalidStatus();if(!controller.active())revert Inactive();Position storage pos=_positions[p.owner];pos.principal=p.amount;pos.baseEntitlement=p.amount;pos.accruedRoi=0;pos.approvedAt=uint64(block.timestamp);pos.lastAccruedAt=uint64(block.timestamp);pos.status=Status.Active;delete pendingStakes[requestId];delete pendingRequestOf[p.owner];emit StakeApproved(requestId,p.owner,p.amount,p.amount,msg.sender);}
    function rejectStake(bytes32 requestId) external nonReentrant onlyAdmin {PendingStake memory p=pendingStakes[requestId];if(p.owner==address(0))revert NoPendingStake();if(pendingRequestOf[p.owner]!=requestId)revert InvalidStatus();delete pendingStakes[requestId];delete pendingRequestOf[p.owner];IMGSTokenMint(address(mgs)).burn(p.amount);emit StakeRejected(requestId,p.owner,p.amount,msg.sender);}
    function position(address owner) external view returns(Position memory){return _positions[owner];} function pendingStake(bytes32 id) external view returns(PendingStake memory){return pendingStakes[id];}
    function pendingRoi(address owner) public view returns(uint256){Position memory p=_positions[owner];if(p.status!=Status.Active||block.timestamp<=p.lastAccruedAt)return 0;return controller.accrue(p.principal,p.lastAccruedAt,uint64(block.timestamp));}
    function claimable(address owner) public view returns(uint256 base,uint256 roi,uint256 total){Position memory p=_positions[owner];if(p.status!=Status.Active)return(0,0,0);base=p.baseEntitlement;roi=p.accruedRoi+pendingRoi(owner);total=base+roi-totalClaimed[owner];}
    function claimReward() external nonReentrant whenNotPaused returns(uint256 total){Position storage p=_positions[msg.sender];if(p.status!=Status.Active)revert InvalidStatus();uint256 roi=pendingRoi(msg.sender);if(roi>0){p.accruedRoi+=roi;p.lastAccruedAt=uint64(block.timestamp);}uint256 gross=p.baseEntitlement+p.accruedRoi;total=gross-totalClaimed[msg.sender];if(total<minimumClaim)revert ClaimTooSmall();totalClaimed[msg.sender]=gross;IMGStakingRewardMinterV2(rewardMinter).mintReward(msg.sender,total);emit RewardClaimed(msg.sender,p.baseEntitlement,p.accruedRoi,total);}
    function setMinimumStake(uint256 v) external onlyAdmin{if(v==0)revert InvalidAmount();minimumStake=v;emit MinimumStakeUpdated(v);} function setMinimumClaim(uint256 v) external onlyAdmin{if(v==0)revert InvalidAmount();minimumClaim=v;emit MinimumClaimUpdated(v);} function setEarningAttester(address v) external onlyAdmin{if(v==address(0))revert InvalidAddress();earningAttester=v;emit EarningAttesterUpdated(v);} function setController(address v) external onlyAdmin{if(v==address(0))revert InvalidAddress();controller=IMintGrowControllerV2(v);} function pause() external onlyAdmin{paused=true;emit Paused(msg.sender);} function unpause() external onlyAdmin{paused=false;emit Unpaused(msg.sender);} function transferAdmin(address v) external onlyAdmin{if(v==address(0))revert InvalidAddress();emit AdminTransferred(admin,v);admin=v;}
    uint256[40] private __gap;
}
