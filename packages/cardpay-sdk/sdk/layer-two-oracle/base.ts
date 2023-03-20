import Web3 from 'web3';
import { Contract } from 'web3-eth-contract';
import { AbiItem } from 'web3-utils';
import PriceOracleABI from '../../contracts/abi/v0.9.0/price-oracle';
import ExchangeABI from '../../contracts/abi/v0.9.0/exchange';
import { getOracle, getAddress } from '../../contracts/addresses';
import BN from 'bn.js';
import { safeFloatConvert } from '../utils/general-utils';

const tokenDecimals = new BN('18');
const ten = new BN('10');

/**
 * The `LayerTwoOracle` API is used to get the current exchange rates in USD and ETH for the various stablecoin that we support. These rates are fed by the Chainlink price feeds for the stablecoin rates and the DIA oracle for the CARD token rates. As we onboard new stablecoin we'll add more exchange rates. The price oracles that we use reside in layer 2, so please supply a layer 2 web3 instance obtaining an `LayerTwoOracle` API from `getSDK()`.
 * @example
 * ```ts
 * import { getSDK } from "@cardstack/cardpay-sdk";
 * let web3 = new Web3(myProvider); // Layer 2 web3 instance
 * let layerTwoOracle = await getSDK('LayerTwoOracle', web3);
 * ```
 * @group Cardpay
 */
export default class LayerTwoOracle {
  constructor(private layer2Web3: Web3) {}

  /**
   * This call will convert a SPEND amount into the specified token amount, where the result is a string that represents the token in units of `wei`. Since SPEND tokens represent $0.01 USD, it is safe to represent SPEND as a number when providing the input value.
   * @example
   * ```ts
   * let weiAmount = await layerTwoOracle.convertFromSpend(daicpxdAddress, 10000); // convert 10000 SPEND into DAI
   * console.log(`DAI value ${fromWei(weiAmount)}`);
   * ```
   */
  async convertToSpend(token: string, amount: string): Promise<number> {
    let exchange = new this.layer2Web3.eth.Contract(
      ExchangeABI as AbiItem[],
      await getAddress('exchange', this.layer2Web3)
    );
    let spendAmount = await exchange.methods.convertToSpend(token, amount).call();
    // 1 SPEND == $0.01 USD, and SPEND decimals is 0, so this is safe to
    // represent as a javascript number
    return Number(spendAmount);
  }

  async convertFromSpend(token: string, amount: number): Promise<string> {
    let exchange = new this.layer2Web3.eth.Contract(
      ExchangeABI as AbiItem[],
      await getAddress('exchange', this.layer2Web3)
    );
    return await exchange.methods.convertFromSpend(token, amount.toString()).call();
  }

  async getRateLock(tokenAddress: string): Promise<string> {
    let exchange = new this.layer2Web3.eth.Contract(
      ExchangeABI as AbiItem[],
      await getAddress('exchange', this.layer2Web3)
    );
    let { price } = await exchange.methods.exchangeRateOf(tokenAddress).call();
    return price;
  }

  /**
   * This returns a function that converts an amount of a token in wei to USD. Similar to `LayerTwoOracle.getUSDPrice`, an exception will be thrown if we don't have the exchange rate for the token. The returned function accepts a string that represents an amount in wei and returns a number that represents the USD value of that amount of the token. Currently, we assume 18 decimals so only tokens conforming to this can be supported.
   * @example
   * ```ts
   * let layerTwoOracle = await getSDK('LayerTwoOracle', web3);
   * let converter = await layerTwoOracle.getUSDConverter("DAI");
   * console.log(`USD value: $${converter(amountInWei)} USD`);
   * ```
   */
  async getUSDConverter(token: string): Promise<(amountInWei: string) => number> {
    const oracle = await this.getOracleContract(token);
    const usdRawRate = new BN((await oracle.methods.usdPrice().call()).price);
    const oracleDecimals = Number(await oracle.methods.decimals().call());

    return (amountInWei) => {
      let rawAmount = usdRawRate.mul(new BN(amountInWei)).div(ten.pow(tokenDecimals));
      return safeFloatConvert(rawAmount, oracleDecimals);
    };
  }

  /**
   * This call will return the USD value for the specified amount of the specified token. If we do not have an exchange rate for the token, then an exception will be thrown. This API requires that the token amount be specified in `wei` (10<sup>18</sup> `wei` = 1 token) as a string, and will return a floating point value in units of USD. You can easily convert a token value to wei by using the `Web3.utils.toWei()` function. Currently, we assume 18 decimals so only tokens conforming to this can be supported.
   * @example
   * ```ts
   * let layerTwoOracle = await getSDK('LayerTwoOracle', web3);
   * let usdPrice = await layerTwoOracleRate.getUSDPrice("DAI", amountInWei);
   * console.log(`USD value: $${usdPrice.toFixed(2)} USD`);
   * ```
   */
  async getUSDPrice(token: string, amount: string): Promise<number> {
    let oracle = await this.getOracleContract(token);
    let usdRawRate = new BN((await oracle.methods.usdPrice().call()).price);
    let oracleDecimals = Number(await oracle.methods.decimals().call());
    let rawAmount = usdRawRate.mul(new BN(amount)).div(ten.pow(tokenDecimals));
    return safeFloatConvert(rawAmount, oracleDecimals);
  }

  /**
   * This call will return the ETH value for the specified amount of the specified token. If we do not have an exchange rate for the token, then an exception will be thrown. This API requires that the token amount be specified in `wei` (10<sup>18</sup> `wei` = 1 token) as a string, and will return a string that represents the ETH value in units of `wei` as well. You can easily convert a token value to wei by using the `Web3.utils.toWei()` function. You can also easily convert units of `wei` back into `ethers` by using the `Web3.utils.fromWei()` function. Currently, we assume 18 decimals so only tokens conforming to this can be supported.
   * @example
   * ```ts
   * let layerTwoOracle = await getSDK('LayerTwoOracle', web3);
   * let ethWeiPrice = await layerTwoOracle.getETHPrice("CARD", amountInWei);
   * console.log(`ETH value: ${fromWei(ethWeiPrice)} ETH`);
   * ```
   */
  async getETHPrice(token: string, amount: string): Promise<string> {
    let oracle = await this.getOracleContract(token);
    let ethRawRate = new BN((await oracle.methods.ethPrice().call()).price);
    let oracleDecimals = new BN(await oracle.methods.decimals().call());
    let weiAmount = ethRawRate.mul(new BN(amount)).div(ten.pow(oracleDecimals));
    return weiAmount.toString();
  }

  /**
   * This call will return a `Date` instance that indicates the date the token rate was last updated.
   * @example
   * ```ts
   * let layerTwoOracle = await getSDK('LayerTwoOracle', web3);
   * let date = await layerTwoOracle.getUpdatedAt("DAI");
   * console.log(`The ${token} rate was last updated at ${date.toString()}`);
   * ```
   */
  async getUpdatedAt(token: string): Promise<Date> {
    let oracle = await this.getOracleContract(token);
    let unixTime = Number((await oracle.methods.usdPrice().call()).updatedAt);
    return new Date(unixTime * 1000);
  }

  private async getOracleContract(token: string): Promise<Contract> {
    let address = await getOracle(token, this.layer2Web3);
    return new this.layer2Web3.eth.Contract(PriceOracleABI as AbiItem[], address);
  }
}
