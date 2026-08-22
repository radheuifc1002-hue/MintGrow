const { ethers } = require('hardhat');

function envAddress(name, required = true) {
  const v = process.env[name];
  if (!v && required) throw new Error(`${name} is required`);
  if (!v) return ethers.ZeroAddress;
  if (!ethers.isAddress(v)) throw new Error(`${name} is not a valid address`);
  return v;
}

async function wait(contract) {
  const tx = await contract.deploymentTransaction();
  if (tx) await tx.wait(1);
}

async function deploy(name, args = []) {
  const F = await ethers.getContractFactory(name);
  const c = await F.deploy(...args);
  await c.waitForDeployment();
  await wait(c);
  console.log(`${name}: ${await c.getAddress()}`);
  return c;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  if (![56, 97].includes(chainId)) throw new Error(`Unsupported chain ${chainId}; use BSC 56 or BSC testnet 97`);

  const multisig = envAddress('MULTISIG_ADDRESS');
  const sponsor = envAddress('SPONSOR_ADDRESS');
  const earningAttester = envAddress('EARNING_ATTESTER_ADDRESS');
  const initialRoiBps = BigInt(process.env.INITIAL_ROI_BPS || '100');
  const minRoiBps = BigInt(process.env.MIN_ROI_BPS || '0');
  const maxRoiBps = BigInt(process.env.MAX_ROI_BPS || '1000');
  const tokenAdminDelay = Number(process.env.TOKEN_ADMIN_DELAY || '0');

  if (multisig.toLowerCase() === ethers.ZeroAddress) throw new Error('MULTISIG_ADDRESS cannot be zero');
  if (sponsor.toLowerCase() === ethers.ZeroAddress) throw new Error('SPONSOR_ADDRESS cannot be zero');
  if (earningAttester.toLowerCase() === ethers.ZeroAddress) throw new Error('EARNING_ATTESTER_ADDRESS cannot be zero');
  console.log(`Network: ${chainId}; deployer: ${deployer.address}; multisig: ${multisig}`);

  // Tokens are temporarily administered by the deployer so this script can grant
  // the final minter/pauser/blacklister roles after the proxy addresses exist.
  const mg = await deploy('MGToken', [deployer.address, tokenAdminDelay]);
  const mgs = await deploy('MGSToken', [deployer.address, tokenAdminDelay]);

  const controller = await deploy('MintGrowControllerV2');
  await (await controller.initialize(multisig, minRoiBps, maxRoiBps, initialRoiBps, true)).wait(1);

  const stakingImpl = await deploy('MintGrowStakingV2');
  const delegationImpl = await deploy('MintGrowStakeDelegationV2');
  const rewardMinter = await deploy('MGStakingMinterV2');

  // Deploy proxies with empty init data first. This breaks the staking/delegation
  // circular address dependency. The deployer is not ProxyAdmin, so it can call
  // the implementation initializer through the transparent proxy.
  const StakingProxy = await ethers.getContractFactory('MintGrowStakingProxyV2');
  const stakingProxy = await StakingProxy.deploy(
    await stakingImpl.getAddress(),
    multisig,
    '0x'
  );
  await stakingProxy.waitForDeployment();
  await wait(stakingProxy);

  const DelegationProxy = await ethers.getContractFactory('MintGrowStakeDelegationProxyV2');
  const delegationProxy = await DelegationProxy.deploy(
    await delegationImpl.getAddress(),
    multisig,
    '0x'
  );
  await delegationProxy.waitForDeployment();
  await wait(delegationProxy);

  const staking = await ethers.getContractAt('MintGrowStakingV2', await stakingProxy.getAddress());
  const delegation = await ethers.getContractAt('MintGrowStakeDelegationV2', await delegationProxy.getAddress());

  await (await rewardMinter.initialize(multisig, await mg.getAddress(), await stakingProxy.getAddress())).wait(1);
  await (await staking.initialize(
    multisig,
    await mgs.getAddress(),
    await mg.getAddress(),
    await delegationProxy.getAddress(),
    await rewardMinter.getAddress(),
    await controller.getAddress(),
    earningAttester
  )).wait(1);
  await (await delegation.initialize(multisig, sponsor, await stakingProxy.getAddress())).wait(1);

  // Wire token minters. MG is minted only by the staking reward minter; MGS is
  // minted only by the staking proxy into itself.
  const mgMinterRole = await mg.MINTER_ROLE();
  const mgsMinterRole = await mgs.MINTER_ROLE();
  await (await mg.grantRole(mgMinterRole, await rewardMinter.getAddress())).wait(1);
  await (await mgs.grantRole(mgsMinterRole, await stakingProxy.getAddress())).wait(1);

  const pauser = await mg.PAUSER_ROLE();
  const blacklister = await mg.BLACKLISTER_ROLE();
  await (await mg.grantRole(pauser, multisig)).wait(1);
  await (await mg.grantRole(blacklister, multisig)).wait(1);
  await (await mgs.grantRole(await mgs.PAUSER_ROLE(), multisig)).wait(1);
  await (await mgs.grantRole(await mgs.BLACKLISTER_ROLE(), multisig)).wait(1);

  // Remove temporary deployer operational roles. Default-admin ownership is
  // transferred separately below and must be accepted by the multisig.
  await (await mg.renounceRole(pauser, deployer.address)).wait(1);
  await (await mg.renounceRole(blacklister, deployer.address)).wait(1);
  await (await mgs.renounceRole(await mgs.PAUSER_ROLE(), deployer.address)).wait(1);
  await (await mgs.renounceRole(await mgs.BLACKLISTER_ROLE(), deployer.address)).wait(1);

  const addresses = {
    chainId,
    deployer: deployer.address,
    multisig,
    sponsor,
    earningAttester,
    MGToken: await mg.getAddress(),
    MGSToken: await mgs.getAddress(),
    ControllerV2: await controller.getAddress(),
    MGStakingMinterV2: await rewardMinter.getAddress(),
    StakingImplementationV2: await stakingImpl.getAddress(),
    StakingProxyV2: await stakingProxy.getAddress(),
    DelegationImplementationV2: await delegationImpl.getAddress(),
    DelegationProxyV2: await delegationProxy.getAddress(),
  };

  // AccessControlDefaultAdminRules requires the new admin to accept the transfer.
  // This is intentionally left as a multisig action rather than using a deployer
  // private key. After acceptance, the deployer has no token administration role.
  console.log('\n=== DEPLOYMENT ADDRESSES ===');
  console.log(JSON.stringify(addresses, null, 2));
  console.log('\n=== REQUIRED MULTISIG FINALIZATION ===');
  console.log(`MGToken.beginDefaultAdminTransfer(${multisig})`);
  console.log(`MGSToken.beginDefaultAdminTransfer(${multisig})`);
  console.log('Then the multisig must call acceptDefaultAdminTransfer() on both tokens.');
  console.log('Verify MINTER_ROLE: MGStakingMinterV2 on MGToken; StakingProxyV2 on MGSToken.');

  const fs = require('fs');
  const path = require('path');
  const out = path.join(process.cwd(), 'deployments');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, `bsc-v2-${chainId}.json`), JSON.stringify(addresses, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
