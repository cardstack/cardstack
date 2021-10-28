import Web3 from 'web3';
import { Contract } from 'web3-eth-contract';
import { AbiItem } from 'web3-utils';
import PriceOracleABI from '../../contracts/abi/v0.8.4/price-oracle';
import ExchangeABI from '../../contracts/abi/v0.8.4/exchange';
import { getOracle, getAddress } from '../../contracts/addresses';
import BN from 'bn.js';
import { safeFloatConvert } from '../utils/general-utils';

const tokenDecimals = new BN('18');
const ten = new BN('10');

export default class LayerTwoOracle {
  constructor(private layer2Web3: Web3) {}

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

  async getUSDConverter(token: string): Promise<(amountInWei: string) => number> {
    const oracle = await this.getOracleContract(token);
    const usdRawRate = new BN((await oracle.methods.usdPrice().call()).price);
    const oracleDecimals = Number(await oracle.methods.decimals().call());

    return (amountInWei) => {
      let rawAmount = usdRawRate.mul(new BN(amountInWei)).div(ten.pow(tokenDecimals));
      return safeFloatConvert(rawAmount, oracleDecimals);
    };
  }

  async getUSDPrice(token: string, amount: string): Promise<number> {
    let oracle = await this.getOracleContract(token);
    let usdRawRate = new BN((await oracle.methods.usdPrice().call()).price);
    let oracleDecimals = Number(await oracle.methods.decimals().call());
    let rawAmount = usdRawRate.mul(new BN(amount)).div(ten.pow(tokenDecimals));
    return safeFloatConvert(rawAmount, oracleDecimals);
  }

  async getETHPrice(token: string, amount: string): Promise<string> {
    let oracle = await this.getOracleContract(token);
    let ethRawRate = new BN((await oracle.methods.ethPrice().call()).price);
    let oracleDecimals = new BN(await oracle.methods.decimals().call());
    let weiAmount = ethRawRate.mul(new BN(amount)).div(ten.pow(oracleDecimals));
    return weiAmount.toString();
  }

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
