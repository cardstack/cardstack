/*global fetch */

import { Fetcher, Route, Price } from '@uniswap/sdk';
import { getAddressByNetwork } from '../../contracts/addresses';
import { getConstantByNetwork } from '../constants';
import JsonRpcProvider from '../../providers/json-rpc-provider';
import { networkName } from './general-utils';
import { BaseProvider } from '@ethersproject/providers';
import { BigNumber } from 'ethers';
import { convertChainIdToName } from '../network-config-utils';

type GasPrice = Record<'slow' | 'standard' | 'fast', BigNumber>;

async function tokenPairRate(provider: JsonRpcProvider, token1Address: string, token2Address: string): Promise<Price> {
  let network = await provider.getNetwork();
  let token1 = await Fetcher.fetchTokenData(network.chainId, token1Address, provider as unknown as BaseProvider);
  let token2 = await Fetcher.fetchTokenData(network.chainId, token2Address, provider as unknown as BaseProvider);

  let pair = await Fetcher.fetchPairData(token1, token2, provider as unknown as BaseProvider);

  let route = new Route([pair], token2);

  return route.midPrice; // How many "token 1" we can get for one "token 2" in Uniswap
}

export async function gasPriceInToken(
  provider: JsonRpcProvider,
  tokenAddress: string,
  gasPriceInNativeTokenInWei?: BigNumber
): Promise<BigNumber> {
  let network = await networkName(provider);
  let chainId = (await provider.getNetwork()).chainId;

  if (!gasPriceInNativeTokenInWei) {
    // Gas station will return current gas price in native token in wei.
    gasPriceInNativeTokenInWei = (await getCurrentGasPrice(chainId)).standard;
  }

  // We use the wrapped native token address because the native token doesn't have an address in Uniswap.
  // The price of the wrapped native token, such as WETH, is the same as the price of the native token.
  let wrappedNativeToken = getAddressByNetwork('wrappedNativeToken', network);
  if (tokenAddress === wrappedNativeToken) {
    return gasPriceInNativeTokenInWei;
  }
  let rate = await tokenPairRate(provider, tokenAddress, wrappedNativeToken);

  // Convert the current gas price which is in native token to the token we want to pay the gas with.
  return gasPriceInNativeTokenInWei
    .mul(BigNumber.from(rate.adjusted.numerator.toString())) // rate.adjusted is an adjustment of the difference in coin decimals, for example WETH has 18 decimals, USDT and USDC have 6.
    .div(BigNumber.from(rate.adjusted.denominator.toString()));
}

export async function getCurrentGasPrice(chainId: number): Promise<GasPrice> {
  const network = convertChainIdToName(chainId);

  let gasStationResponse = await fetch(`${getConstantByNetwork('hubUrl', network)}/api/gas-station/${chainId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
    },
  });
  let gasPriceJson = await gasStationResponse.json();

  return {
    slow: BigNumber.from(gasPriceJson.slow),
    standard: BigNumber.from(gasPriceJson.standard),
    fast: BigNumber.from(gasPriceJson.fast),
  };
}

export async function getNativeWeiInToken(provider: JsonRpcProvider, tokenAddress: string): Promise<BigNumber> {
  let naticeWeiInUSD;
  try {
    naticeWeiInUSD = await gasPriceInToken(provider, tokenAddress, BigNumber.from(1));
  } catch (e) {
    naticeWeiInUSD = BigNumber.from(0);
  }

  return naticeWeiInUSD;
}
