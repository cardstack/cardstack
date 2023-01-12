/*global fetch */

/* eslint-disable node/no-extraneous-import */
import { Token, CurrencyAmount, Price, Fraction } from '@uniswap/sdk-core';

import { Pair, Route } from '@uniswap/v2-sdk';
import { getAddressByNetwork } from '../../contracts/addresses';
import { getConstantByNetwork, SchedulerCapableNetworks } from '../constants';
import JsonRpcProvider from '../../providers/json-rpc-provider';
import { networkName } from './general-utils';
import BN from 'bn.js';
import { BigNumber } from 'ethers';
import { BaseProvider } from '@ethersproject/providers';
import { convertChainIdToName } from '../network-config-utils';
import { Contract } from 'ethers';
import ERC20ABI from '../../contracts/abi/erc-20';
import IUniswapV2Pair from '@uniswap/v2-core/build/IUniswapV2Pair.json';

type GasPrice = Record<'slow' | 'standard' | 'fast', BN>;

async function fetchTokenData(chainId: number, tokenAddress: string, provider: BaseProvider): Promise<Token> {
  let tokenContract = new Contract(tokenAddress, ERC20ABI, provider);
  let decimals = await tokenContract.decimals();
  return new Token(chainId, tokenAddress, decimals);
}

async function fetchPairData(
  tokenA: Token,
  tokenB: Token,
  uniswapV2Factory: string,
  initCodeHash: string,
  provider: BaseProvider
): Promise<Pair> {
  let address = Pair.getAddress(tokenA, tokenB, uniswapV2Factory, initCodeHash);
  const [reserves0, reserves1] = await new Contract(address, IUniswapV2Pair.abi, provider).getReserves();
  const balances = tokenA.sortsBefore(tokenB) ? [reserves0, reserves1] : [reserves1, reserves0];
  return new Pair(
    CurrencyAmount.fromRawAmount(tokenA, balances[0]),
    CurrencyAmount.fromRawAmount(tokenB, balances[1]),
    uniswapV2Factory,
    initCodeHash
  );
}

//Adjustment of the difference in coin decimals, for example WETH has 18 decimals, USDT and USDC have 6.
function adjustRate(rate: Price<Token, Token>): Fraction {
  let fraction = new Fraction(rate.numerator, rate.denominator);
  return fraction.multiply(rate.scalar);
}

async function tokenPairRate(
  provider: JsonRpcProvider,
  token1Address: string,
  token2Address: string
): Promise<Price<Token, Token>> {
  let network = await provider.getNetwork();
  let token1 = await fetchTokenData(network.chainId, token1Address, provider as unknown as BaseProvider);
  let token2 = await fetchTokenData(network.chainId, token2Address, provider as unknown as BaseProvider);

  let networkName = convertChainIdToName(network.chainId);
  let uniswapV2Factory = getAddressByNetwork('uniswapV2Factory', networkName);
  let initCodeHash = getConstantByNetwork('uniswapPairInitCodeHash', networkName as SchedulerCapableNetworks);
  let pair = await fetchPairData(token1, token2, uniswapV2Factory, initCodeHash, provider);

  let route = new Route([pair], token2, token1);

  return route.midPrice; // How many "token 1" we can get for one "token 2" in Uniswap
}

export async function gasPriceInToken(provider: JsonRpcProvider, tokenAddress: string): Promise<BN> {
  let network = await networkName(provider);
  let chainId = (await provider.getNetwork()).chainId;

  // Gas station will return current gas price in native token in wei.
  let gasPriceInNativeTokenInWei = new BN((await getGasPricesInNativeWei(chainId)).standard.toString());

  // We use the wrapped native token address because the native token doesn't have an address in Uniswap.
  // The price of the wrapped native token, such as WETH, is the same as the price of the native token.
  let wrappedNativeToken = getAddressByNetwork('wrappedNativeToken', network);
  if (tokenAddress === wrappedNativeToken) {
    return gasPriceInNativeTokenInWei;
  }
  let rate = await tokenPairRate(provider, tokenAddress, wrappedNativeToken);
  let rateAdjusted = adjustRate(rate);
  // Convert the current gas price which is in native token to the token we want to pay the gas with.
  return gasPriceInNativeTokenInWei
    .mul(new BN(rateAdjusted.numerator.toString()))
    .div(new BN(rateAdjusted.denominator.toString()));
}

export async function getGasPricesInNativeWei(
  chainId: number,
  options: { hubUrl?: string | null } = {}
): Promise<GasPrice> {
  const network = convertChainIdToName(chainId);

  let gasStationResponse = await fetch(
    `${options.hubUrl || getConstantByNetwork('hubUrl', network)}/api/gas-station/${chainId}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/vnd.api+json',
        Accept: 'application/vnd.api+json',
      },
    }
  );
  let gasPriceJson = await gasStationResponse.json();

  return {
    slow: new BN(gasPriceJson.data.attributes.slow),
    standard: new BN(gasPriceJson.data.attributes.standard),
    fast: new BN(gasPriceJson.data.attributes.fast),
  };
}

export async function getNativeWeiInToken(provider: JsonRpcProvider, tokenAddress: string): Promise<BN> {
  let network = await networkName(provider);
  let wrappedNativeToken = getAddressByNetwork('wrappedNativeToken', network);
  if (tokenAddress === wrappedNativeToken) {
    return new BN(1);
  }

  let rate = await tokenPairRate(provider, tokenAddress, wrappedNativeToken);
  let rateAdjusted = adjustRate(rate);
  return new BN(rateAdjusted.numerator.toString()).div(new BN(rateAdjusted.denominator.toString()));
}

export async function getUsdConverter(
  provider: JsonRpcProvider,
  tokenAddress: string
): Promise<(amountInWei: BigNumber) => BigNumber> {
  let network = await networkName(provider);
  let usdcTokenAddress = getAddressByNetwork('usdcToken', network);

  if (usdcTokenAddress === tokenAddress) {
    return (amountInWei: BigNumber) => amountInWei;
  }

  let rate = await tokenPairRate(provider, tokenAddress, usdcTokenAddress);
  return (amountInWei: BigNumber) => {
    let rateAdjusted = adjustRate(rate);
    return amountInWei.mul(rateAdjusted.numerator.toString()).div(rateAdjusted.denominator.toString());
  };
}
