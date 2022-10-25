/*global fetch */

import { Fetcher, Route, Price } from '@uniswap/sdk';
import { getAddressByNetwork } from '../../contracts/addresses';
import { getConstantByNetwork } from '../constants';
import JsonRpcProvider from '../../providers/json-rpc-provider';
import { networkName } from './general-utils';
import BN from 'bn.js';
import { BaseProvider } from '@ethersproject/providers';

async function tokenPairRate(provider: JsonRpcProvider, token1Address: string, token2Address: string): Promise<Price> {
  let network = await provider.getNetwork();
  let token1 = await Fetcher.fetchTokenData(network.chainId, token1Address, provider as unknown as BaseProvider);
  let token2 = await Fetcher.fetchTokenData(network.chainId, token2Address, provider as unknown as BaseProvider);

  let pair = await Fetcher.fetchPairData(token1, token2, provider as unknown as BaseProvider);

  let route = new Route([pair], token2);

  return route.midPrice; // How many "token 1" we can get for one "token 2" in Uniswap
}

export async function gasPriceInToken(provider: JsonRpcProvider, tokenAddress: string): Promise<BN> {
  let network = await networkName(provider);

  // We use the wrapped native token address because the native token doesn't have an address in Uniswap.
  // The price of the wrapped native token, such as WETH, is the same as the price of the native token.
  let rate = await tokenPairRate(provider, tokenAddress, getAddressByNetwork('wrappedNativeToken', network));

  // Gas station will return current gas price in native token in wei.
  let gasStationResponse = await fetch(`${getConstantByNetwork('relayServiceURL', network)}/v1/gas-station/`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });

  let gasPriceInNativeTokenInWei = new BN((await gasStationResponse.json()).standard);

  // Convert the current gas price which is in native token to the token we want to pay the gas with.
  return gasPriceInNativeTokenInWei
    .mul(new BN(rate.adjusted.numerator.toString())) // rate.adjusted is an adjustment of the difference in coin decimals, for example WETH has 18 decimals, USDT and USDC have 6.
    .div(new BN(rate.adjusted.denominator.toString()));
}
