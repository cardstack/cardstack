import BN from 'bn.js';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import CHAINLINK_PRICEFEED_ABI from '../contracts/abi/chainlink-aggregator-v3';
import { getAddress } from '../contracts/addresses';
import { safeContractCall, safeFloatConvert } from './utils/general-utils';

/**
 * @group Cardpay
 */
export interface ILayerOneOracle {
  ethToUsd(ethAmount: string): Promise<number>;
  getEthToUsdUpdatedAt(): Promise<Date>;
  getEthToUsdConverter(): Promise<(ethAmountInWei: string) => number>;
}

const ethDecimals = new BN('18');
const ten = new BN('10');

/**
 * The `LayerOneOracle` API is used to get the current exchange rates in USD of ETH. This rate us fed by the Chainlink price feeds. Please supply a layer 1 web3 instance obtaining an `LayerOneOracle` API from `getSDK()
 * @example
 * ```ts
 * import { getSDK } from "@cardstack/cardpay-sdk";
 * let web3 = new Web3(myProvider); // Layer 1 web3 instance
 * let layerOneOracle = await getSDK('LayerOneOracle', web3);
 * ```
 * @group Cardpay
 */
export default class LayerOneOracle implements ILayerOneOracle {
  constructor(private layer1Web3: Web3) {}

  /**
   * This call will return the USD value for the specified amount of ETH. This API requires that the amount be specified in `wei` (10<sup>18</sup> `wei` = 1 token) as a string, and will return a floating point value in units of USD. You can easily convert an ETH value to wei by using the `Web3.utils.toWei()` function.
   * @example
   * ```ts
   * let layerOneOracle = await getSDK('LayerOneOracle', web3);
   * let usdPrice = await exchangelayerOneOracleRate.ethToUsd(amountInWei);
   * console.log(`USD value: $${usdPrice.toFixed(2)} USD`);
   *```
   */
  async ethToUsd(ethAmount: string): Promise<number> {
    let ethToUsdAddress = await getAddress('chainlinkEthToUsd', this.layer1Web3);
    let oracle = new this.layer1Web3.eth.Contract(CHAINLINK_PRICEFEED_ABI as AbiItem[], ethToUsdAddress);
    let roundData = (await safeContractCall(this.layer1Web3, oracle, 'latestRoundData')) as any;
    let usdRawRate = new BN(roundData.answer);
    let oracleDecimals = Number(await safeContractCall(this.layer1Web3, oracle, 'decimals'));
    let rawAmount = usdRawRate.mul(new BN(ethAmount)).div(ten.pow(ethDecimals));
    return safeFloatConvert(rawAmount, oracleDecimals);
  }

  async getEthToUsdUpdatedAt(): Promise<Date> {
    let ethToUsdAddress = await getAddress('chainlinkEthToUsd', this.layer1Web3);
    let oracle = new this.layer1Web3.eth.Contract(CHAINLINK_PRICEFEED_ABI as AbiItem[], ethToUsdAddress);
    let roundData = (await safeContractCall(this.layer1Web3, oracle, 'latestRoundData')) as any;
    return new Date(roundData.updatedAt * 1000);
  }

  /**
   * This returns a function that converts an amount of ETH in wei to USD. The returned function accepts a string that represents an amount in wei and returns a number that represents the USD value of that amount of ETH.
   * @example
   * ```ts
   * let layerOneOracle = await getSDK('LayerOneOracle', web3);
   * let converter = await layerOneOracle.getEthToUsdConverter();
   * console.log(`USD value: $${converter(amountInWei)} USD`);
   *```
   */
  async getEthToUsdConverter(): Promise<(ethAmountInWei: string) => number> {
    let ethToUsdAddress = await getAddress('chainlinkEthToUsd', this.layer1Web3);
    let oracle = new this.layer1Web3.eth.Contract(CHAINLINK_PRICEFEED_ABI as AbiItem[], ethToUsdAddress);
    let roundData = (await safeContractCall(this.layer1Web3, oracle, 'latestRoundData')) as any;
    let usdRawRate = new BN(roundData.answer);
    let oracleDecimals = Number(await safeContractCall(this.layer1Web3, oracle, 'decimals'));

    return (ethAmountInWei) => {
      let rawAmount = usdRawRate.mul(new BN(ethAmountInWei)).div(ten.pow(ethDecimals));
      return safeFloatConvert(rawAmount, oracleDecimals);
    };
  }
}
