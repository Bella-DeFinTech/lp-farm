import { Wallet, Provider, utils } from "zksync-web3";
import * as ethers from "ethers";
import { BigNumber } from "bignumber.js";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

import { sk } from "../.secret"
import { dev, prod} from '../scripts/deployed'

import Web3 from "web3";

import tokenABI from '../abi/token.json'

import * as fs from 'fs'

const rpcUrl = process.env.NET_TYPE==='dev' ? 'https://zksync2-testnet.zksync.dev' : 'https://zksync2-mainnet.zksync.io'
const web3 = new Web3(new Web3.providers.HttpProvider(rpcUrl));

async function getTokenDecimal(web3: Web3, address: string): Promise<number> {
    const contract = new web3.eth.Contract(tokenABI as any, address)
    return Number(await (contract.methods.decimals().call()))
}

async function priceNoDecimal(web3: Web3, tokenAddr0, tokenAddr1, priceDecimal0By1) {
  
    var decimal0 = await getTokenDecimal(web3, tokenAddr0);
    var decimal1 = await getTokenDecimal(web3, tokenAddr1);
    console.log('tokenAddr0:', tokenAddr0, ' ', decimal0)
    console.log('tokenAddr1:', tokenAddr1, ' ', decimal1)
    var priceNoDecimal0By1 = priceDecimal0By1 * (10 ** decimal1) / (10 ** decimal0);
    return priceNoDecimal0By1;
}

function pointRounding(point: number, pointDelta: number, upper: boolean): number {
    let mod = point % pointDelta
    if (mod < 0) {
        mod += pointDelta
    }
    if (!upper) {
        return point - mod
    }
    return point + pointDelta - mod
}

export default async function (hre: HardhatRuntimeEnvironment) {

  const netType = process.env.NET_TYPE
  const contracts = netType === 'dev' ? dev : prod
  const farmConfigPath = __dirname + "/../config." + netType + "/fixRange.json"
  const farmConfigJsonString = fs.readFileSync(farmConfigPath, 'utf-8')
  const farmConfig = JSON.parse(farmConfigJsonString);

  const feeLimit = process.env.FEE_LIMIT
  console.log('nettype: ', netType)
  console.log('contracts: ', contracts)
  console.log('feeLimit: ', feeLimit)

  const liquidityManager = contracts.liquidityManager
  const token0Symbol = farmConfig['token0']
  const token0Address = contracts[token0Symbol]
  const token1Symbol = farmConfig['token1']
  const token1Address = contracts[token1Symbol]
  const fee =farmConfig['fee']
  const pointDelta = farmConfig['pointDelta']

  let tokenXAddress = token0Address
  let tokenYAddress = token1Address

  const priceLower0By1 = farmConfig['priceLower0By1']
  const priceUpper0By1 = farmConfig['priceUpper0By1']

  let poolPriceLower = await priceNoDecimal(
      web3,
      token0Address,
      token1Address,
      priceLower0By1
  )
  let poolPriceUpper = await priceNoDecimal(
      web3,
      token0Address,
      token1Address,
      priceUpper0By1
  )

  console.log('priceLower: ', poolPriceLower)
  console.log('priceUpper: ', poolPriceUpper)

  if (token0Address.toLowerCase() > token1Address.toLowerCase()) {
    tokenXAddress = token1Address
    tokenYAddress = token0Address

    let newLower = 1 / poolPriceUpper
    let newUpper = 1 / poolPriceLower
    poolPriceLower = newLower
    poolPriceUpper = newUpper

  }
  console.log('price lower: ', poolPriceLower)
  console.log('price upper: ', poolPriceUpper)
  const leftPointRaw = Math.floor(
    Math.log(poolPriceLower) / Math.log(1.0001)
  )
  const rightPointRaw = Math.ceil(
    Math.log(poolPriceUpper) / Math.log(1.0001)
  )
  const leftPoint = pointRounding(leftPointRaw, pointDelta, false)
  const rightPoint = pointRounding(rightPointRaw, pointDelta, true)
  console.log('left point: ', leftPointRaw, leftPoint)
  console.log('right point: ', rightPointRaw, rightPoint)
  const poolParams = {
    iZiSwapLiquidityManager: liquidityManager,
    tokenX: tokenXAddress,
    tokenY: tokenYAddress,
    fee
  }
  const rewardInfos = []
  const configRewardInfos = farmConfig['rewardInfos']
  for (const ri of configRewardInfos) {
      const rewardTokenSymbol = ri['rewardToken']
      const rewardToken = contracts[rewardTokenSymbol]
      const provider = ri['provider']
      const accRewardPerShare = '0'
      const rewardPerSecondDecimal = ri['rewardPerSecond']
      const rewardTokenDecimal = await getTokenDecimal(web3, rewardToken)
      // round down
      const rewardPerSecond = new BigNumber(rewardPerSecondDecimal).times(10 ** rewardTokenDecimal).toFixed(0, 1)
      rewardInfos.push({
          rewardToken, provider, accRewardPerShare, rewardPerSecond
      })
  }

  const boost = farmConfig['boost'] === 'true' ? true : false
  const iziTokenAddr = boost ? contracts['iZi'] : '0x0000000000000000000000000000000000000000'
  const startTime = farmConfig['startTime']
  const endTime = farmConfig['endTime']
  const feeChargePercent = farmConfig['feeChargePercent']
  const chargeReceiver = farmConfig['chargeReceiver']

  const args = [
      poolParams,
      rewardInfos,
      iziTokenAddr,
      rightPoint,
      leftPoint,
      startTime,
      endTime,
      feeChargePercent,
      chargeReceiver
  ]
  console.log('args: ', args)

  const realDeploy = farmConfig['realDeploy']
  if (realDeploy === 'false') {
      return
  }

  // Initialize the wallet.
  const wallet = new Wallet(sk);

  // Create deployer object and load the artifact of the contract you want to deploy.
  const deployer = new Deployer(hre, wallet);
  const contractFactory = await deployer.loadArtifact("FixRangeTimestamp");

  const deploymentFee = await deployer.estimateDeployFee(contractFactory, args);
  const parsedFee = ethers.utils.formatEther(deploymentFee.toString());
  console.log('cost fee: ', parsedFee)
  if (Number(parsedFee) >= Number(feeLimit)) {
    console.log('too much fee, revert!')
    return
  }
  console.log(`The deployment is estimated to cost ${parsedFee} ETH`);

  const farm = await deployer.deploy(contractFactory, args);

  //obtain the Constructor Arguments
  console.log("constructor args:" + farm.interface.encodeDeploy(args));

  // Show the contract info.
  const contractAddress = farm.address;
  console.log(`${contractFactory.contractName} was deployed to ${contractAddress}`);
}
