/* global artifacts network */
const fs = require('fs');
const BN = require('bignumber.js');

const RegistryFactory = artifacts.require('RegistryFactory.sol');
const Registry = artifacts.require('Registry.sol');
const Token = artifacts.require('EIP20.sol');

const config = JSON.parse(fs.readFileSync('../conf/config.json'));
const paramConfig = config.paramDefaults;

global.web3 = web3;
global.artifacts = artifacts;

// For truffle exec
module.exports = function(callback) {
  main().then(() => callback()).catch(err => callback(err))
};

async function main() {
  const newtworkType = await web3.eth.net.getNetworkType();
  const networkID = await web3.eth.net.getId();
  console.log("network type:" + newtworkType);
  console.log("network id:" + networkID);

  const registryFactoryAddress = (
    networkID === '1' ? '0xcc0df91b86795f21c3d43dbeb3ede0dfcf8dccaf' // mainnet
      // : networkID === '4' ? '0x822415a1e4d0d7f99425d794a817d9b823bdcd0c' // rinkeby
      : networkID === '4' ? '0xb22e007b28791e534feb78505abb9b445d1ac842' // rinkeby no-ipfs
      : networkID === '7' ? '0x95D997e7FDb4411C468674Cb0d414812d47eE3DF' // rinkeby no-ipfs
        : RegistryFactory.address // development
  );

  console.log('Using RegistryFactory at:');
  console.log(`     ${registryFactoryAddress}`);
  console.log('');
  console.log('Deploying proxy contracts...');
  console.log('...');

  const registryFactory = await RegistryFactory.at(registryFactoryAddress);
  const registryReceipt = await registryFactory.newRegistryWithToken(
    config.token.supply,
    config.token.name,
    config.token.decimals,
    config.token.symbol,
    [
      paramConfig.minDeposit,
      paramConfig.pMinDeposit,
      paramConfig.applyStageLength,
      paramConfig.pApplyStageLength,
      paramConfig.commitStageLength,
      paramConfig.pCommitStageLength,
      paramConfig.revealStageLength,
      paramConfig.pRevealStageLength,
      paramConfig.dispensationPct,
      paramConfig.pDispensationPct,
      paramConfig.voteQuorum,
      paramConfig.pVoteQuorum,
    ],
    config.name,
  );

  const {
    token,
    plcr,
    parameterizer,
    registry,
  } = registryReceipt.logs[0].args;

  const registryProxy = await Registry.at(registry);
  const tokenProxy = await Token.at(token);
  const registryName = await registryProxy.name.call();

  console.log(`Proxy contracts successfully migrated to network_id: ${networkID}`)
  console.log('');
  console.log(`${config.token.name} (EIP20):`);
  console.log(`     ${token}`);
  console.log(`PLCRVoting:`);
  console.log(`     ${plcr}`);
  console.log(`Parameterizer:`);
  console.log(`     ${parameterizer}`);
  console.log(`${registryName} (Registry):`);
  console.log(`     ${registry}`);
  console.log('');

  const evenTokenDispensation = new BN(config.token.supply).div(config.token.tokenHolders.length)
  console.log(`Dispensing ${config.token.supply} tokens evenly to ${config.token.tokenHolders.length} addresses:`);
  console.log('');

  await Promise.all(config.token.tokenHolders.map(async account => {
    console.log(`Transferring tokens to address: ${account}`);
    return tokenProxy.transfer(account, evenTokenDispensation);
  }));
}
