const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('MintGrow V2 staking flow', function () {
  async function fixture() {
    const [admin, user, sponsor, attester] = await ethers.getSigners();
    const MG = await ethers.getContractFactory('MGToken');
    const MGS = await ethers.getContractFactory('MGSToken');
    const mg = await MG.deploy(admin.address, 0); await mg.waitForDeployment();
    const mgs = await MGS.deploy(admin.address, 0); await mgs.waitForDeployment();
    const Controller = await ethers.getContractFactory('MintGrowControllerV2');
    const controller = await Controller.deploy(admin.address, 0, 1000, 100, true); await controller.waitForDeployment();
    const StakingImpl = await ethers.getContractFactory('MintGrowStakingV2');
    const stakingImpl = await StakingImpl.deploy(); await stakingImpl.waitForDeployment();
    const DelegationImpl = await ethers.getContractFactory('MintGrowStakeDelegationV2');
    const delegationImpl = await DelegationImpl.deploy(); await delegationImpl.waitForDeployment();
    const SP = await ethers.getContractFactory('MintGrowStakingProxyV2');
    const stakingProxy = await SP.deploy(await stakingImpl.getAddress(), admin.address, '0x'); await stakingProxy.waitForDeployment();
    const DP = await ethers.getContractFactory('MintGrowStakeDelegationProxyV2');
    const delegationProxy = await DP.deploy(await delegationImpl.getAddress(), admin.address, '0x'); await delegationProxy.waitForDeployment();
    const Minter = await ethers.getContractFactory('MGStakingMinterV2');
    const minter = await Minter.deploy(admin.address, await mg.getAddress(), await stakingProxy.getAddress()); await minter.waitForDeployment();
    const staking = await ethers.getContractAt('MintGrowStakingV2', await stakingProxy.getAddress());
    const delegation = await ethers.getContractAt('MintGrowStakeDelegationV2', await delegationProxy.getAddress());
    await staking.initialize(admin.address, await mgs.getAddress(), await mg.getAddress(), await delegationProxy.getAddress(), await minter.getAddress(), await controller.getAddress(), attester.address);
    await delegation.initialize(admin.address, sponsor.address, await stakingProxy.getAddress());
    await mg.grantRole(await mg.MINTER_ROLE(), await minter.getAddress());
    await mgs.grantRole(await mgs.MINTER_ROLE(), await stakingProxy.getAddress());
    return { admin, user, sponsor, attester, mg, mgs, controller, staking, delegation, minter };
  }

  async function signVoucher(f, amount, deadline, voucherNonce) {
    const ownerBig = BigInt(f.user.address);
    const amountBig = BigInt(amount);
    const nonce = ownerBig ^ amountBig ^ BigInt(voucherNonce);
    const domain = { name: 'MintGrow Staking', version: '1', chainId: Number((await ethers.provider.getNetwork()).chainId), verifyingContract: await f.staking.getAddress() };
    const types = { StakeEarningVoucher: [
      { name: 'owner', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint256' }, { name: 'voucherNonce', type: 'bytes32' }
    ] };
    return f.attester.signTypedData(domain, types, { owner: f.user.address, amount: amountBig, nonce, deadline, voucherNonce });
  }

  it('mints MGS only to staking contract and leaves the stake pending', async function () {
    const f = await fixture();
    const amount = ethers.parseEther('250000');
    const deadline = BigInt(Math.floor(Date.now()/1000)+900);
    const voucherNonce = ethers.hexlify(ethers.randomBytes(32));
    const voucher = await signVoucher(f, amount, deadline, voucherNonce);
    const authNonce = await f.delegation.nonces(f.user.address);
    const domain = { name: 'MintGrow Stake Delegation', version: '1', chainId: Number((await ethers.provider.getNetwork()).chainId), verifyingContract: await f.delegation.getAddress() };
    const types = { StakeAuthorization: [
      { name: 'owner', type: 'address' }, { name: 'relayer', type: 'address' }, { name: 'staking', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint256' }
    ] };
    const auth = await f.user.signTypedData(domain, types, { owner:f.user.address,relayer:f.sponsor.address,staking:await f.staking.getAddress(),amount,nonce:authNonce,deadline });
    await f.delegation.connect(f.sponsor).requestStake(f.user.address, amount, deadline, auth, voucherNonce, voucher);
    expect(await f.mgs.balanceOf(f.user.address)).to.equal(0);
    expect(await f.mgs.balanceOf(await f.staking.getAddress())).to.equal(amount);
    const id = await f.staking.pendingRequestOf(f.user.address);
    expect(id).to.not.equal(ethers.ZeroHash);
    const p = await f.staking.pendingStake(id);
    expect(p.amount).to.equal(amount);
  });

  it('rejects and burns the pending MGS without giving principal to the user', async function () {
    const f = await fixture(); const amount=ethers.parseEther('250000'); const deadline=BigInt(Math.floor(Date.now()/1000)+900); const voucherNonce=ethers.hexlify(ethers.randomBytes(32)); const voucher=await signVoucher(f,amount,deadline,voucherNonce); const authNonce=await f.delegation.nonces(f.user.address); const domain={name:'MintGrow Stake Delegation',version:'1',chainId:Number((await ethers.provider.getNetwork()).chainId),verifyingContract:await f.delegation.getAddress()}; const types={StakeAuthorization:[{name:'owner',type:'address'},{name:'relayer',type:'address'},{name:'staking',type:'address'},{name:'amount',type:'uint256'},{name:'nonce',type:'uint256'},{name:'deadline',type:'uint256'}]}; const auth=await f.user.signTypedData(domain,types,{owner:f.user.address,relayer:f.sponsor.address,staking:await f.staking.getAddress(),amount,nonce:authNonce,deadline}); await f.delegation.connect(f.sponsor).requestStake(f.user.address,amount,deadline,auth,voucherNonce,voucher); const id=await f.staking.pendingRequestOf(f.user.address); await f.staking.connect(f.admin).rejectStake(id); expect(await f.mgs.balanceOf(await f.staking.getAddress())).to.equal(0); expect(await f.mgs.balanceOf(f.user.address)).to.equal(0); });

  it('uses the 25,000 MG claim threshold and never exposes an unstake path', async function () {
    const f=await fixture(); expect(await f.staking.minimumStake()).to.equal(ethers.parseEther('250000')); expect(await f.staking.minimumClaim()).to.equal(ethers.parseEther('25000')); expect(f.staking.interface.getFunction('unstake')).to.equal(null); expect(f.staking.interface.getFunction('withdraw')).to.equal(null);
  });
});
