const { ethers } = require('hardhat');
function envAddress(name, required = true) { const v=process.env[name]; if(!v&&required)throw new Error(`${name} is required`); if(!v)return ethers.ZeroAddress; if(!ethers.isAddress(v))throw new Error(`${name} is not a valid address`); return v; }
async function wait(c){const tx=c.deploymentTransaction();if(tx)await tx.wait(1);} async function deploy(name,args=[]){const F=await ethers.getContractFactory(name);const c=await F.deploy(...args);await c.waitForDeployment();await wait(c);console.log(`${name}: ${await c.getAddress()}`);return c;}
async function main(){
 const [deployer]=await ethers.getSigners(); const network=await ethers.provider.getNetwork(); const chainId=Number(network.chainId); if(![56,97].includes(chainId))throw new Error(`Unsupported chain ${chainId}`);
 const multisig=envAddress('MULTISIG_ADDRESS'), sponsor=envAddress('SPONSOR_ADDRESS'), earningAttester=envAddress('EARNING_ATTESTER_ADDRESS');
 const initialRoiBps=BigInt(process.env.INITIAL_ROI_BPS||'100'), minRoiBps=BigInt(process.env.MIN_ROI_BPS||'0'), maxRoiBps=BigInt(process.env.MAX_ROI_BPS||'1000'); const tokenAdminDelay=Number(process.env.TOKEN_ADMIN_DELAY||'0');
 console.log(`Network ${chainId}; deployer ${deployer.address}; multisig ${multisig}`);
 // Tokens temporarily use the deployer as default admin so roles can be wired after proxy addresses exist. The handoff is finalized by multisig.
 const mg=await deploy('MGToken',[deployer.address,tokenAdminDelay]); const mgs=await deploy('MGSToken',[deployer.address,tokenAdminDelay]);
 const controller=await deploy('MintGrowControllerV2',[multisig,minRoiBps,maxRoiBps,initialRoiBps,true]);
 const stakingImpl=await deploy('MintGrowStakingV2'); const delegationImpl=await deploy('MintGrowStakeDelegationV2');
 // Proxies are deployed uninitialized to break the mutual staking/delegation address dependency.
 const SP=await ethers.getContractFactory('MintGrowStakingProxyV2'); const stakingProxy=await SP.deploy(await stakingImpl.getAddress(),multisig,'0x'); await stakingProxy.waitForDeployment(); await wait(stakingProxy);
 const DP=await ethers.getContractFactory('MintGrowStakeDelegationProxyV2'); const delegationProxy=await DP.deploy(await delegationImpl.getAddress(),multisig,'0x'); await delegationProxy.waitForDeployment(); await wait(delegationProxy);
 const rewardMinter=await deploy('MGStakingMinterV2',[multisig,await mg.getAddress(),await stakingProxy.getAddress()]);
 const staking=await ethers.getContractAt('MintGrowStakingV2',await stakingProxy.getAddress()); const delegation=await ethers.getContractAt('MintGrowStakeDelegationV2',await delegationProxy.getAddress());
 await(await staking.initialize(multisig,await mgs.getAddress(),await mg.getAddress(),await delegationProxy.getAddress(),await rewardMinter.getAddress(),await controller.getAddress(),earningAttester)).wait(1);
 await(await delegation.initialize(multisig,sponsor,await stakingProxy.getAddress())).wait(1);
 // Final mint wiring.
 const mgMinterRole=await mg.MINTER_ROLE(); const mgsMinterRole=await mgs.MINTER_ROLE(); await(await mg.grantRole(mgMinterRole,await rewardMinter.getAddress())).wait(1); await(await mgs.grantRole(mgsMinterRole,await stakingProxy.getAddress())).wait(1);
 const mgPauser=await mg.PAUSER_ROLE(), mgBlacklister=await mg.BLACKLISTER_ROLE(), mgsPauser=await mgs.PAUSER_ROLE(), mgsBlacklister=await mgs.BLACKLISTER_ROLE();
 await(await mg.grantRole(mgPauser,multisig)).wait(1); await(await mg.grantRole(mgBlacklister,multisig)).wait(1); await(await mgs.grantRole(mgsPauser,multisig)).wait(1); await(await mgs.grantRole(mgsBlacklister,multisig)).wait(1);
 await(await mg.renounceRole(mgPauser,deployer.address)).wait(1); await(await mg.renounceRole(mgBlacklister,deployer.address)).wait(1); await(await mgs.renounceRole(mgsPauser,deployer.address)).wait(1); await(await mgs.renounceRole(mgsBlacklister,deployer.address)).wait(1);
 const addresses={chainId,deployer:deployer.address,multisig,sponsor,earningAttester,MGToken:await mg.getAddress(),MGSToken:await mgs.getAddress(),ControllerV2:await controller.getAddress(),MGStakingMinterV2:await rewardMinter.getAddress(),StakingImplementationV2:await stakingImpl.getAddress(),StakingProxyV2:await stakingProxy.getAddress(),DelegationImplementationV2:await delegationImpl.getAddress(),DelegationProxyV2:await delegationProxy.getAddress()};
 console.log('\n=== DEPLOYMENT ADDRESSES ===\n'+JSON.stringify(addresses,null,2)); console.log('\n=== MULTISIG TOKEN ADMIN HANDOFF ==='); console.log(`MGToken.beginDefaultAdminTransfer(${multisig})`); console.log(`MGSToken.beginDefaultAdminTransfer(${multisig})`); console.log('Then multisig calls acceptDefaultAdminTransfer() on both tokens.');
 const fs=require('fs'),path=require('path');fs.mkdirSync(path.join(process.cwd(),'deployments'),{recursive:true});fs.writeFileSync(path.join(process.cwd(),'deployments',`bsc-v2-${chainId}.json`),JSON.stringify(addresses,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
