/*global fetch */

/* eslint-disable node/no-extraneous-import */
import { Token, CurrencyAmount, Price, Fraction } from '@uniswap/sdk-core';

import { Pair, Route } from '@uniswap/v2-sdk';
import { getAddressByNetwork } from '../../contracts/addresses';
import { getConstantByNetwork, SchedulerCapableNetworks } from '../constants';
import JsonRpcProvider from '../../providers/json-rpc-provider';
import { networkName } from './general-utils';
import BN from 'bn.js';
import { BigNumber, FixedNumber } from 'ethers';
import { BaseProvider } from '@ethersproject/providers';
import { convertChainIdToName } from '../network-config-utils';
import { Contract } from 'ethers';
import ERC20ABI from '../../contracts/abi/erc-20';
import IUniswapV2Pair from '@uniswap/v2-core/build/IUniswapV2Pair.json';

type GasPrice = Record<'slow' | 'standard' | 'fast', BN>;
/**
 * @group Utils
 * @category Conversion
 */
export interface TokenPairRate {
  tokenInAddress: string;
  tokenOutAddress: string;
  tokenInDecimals: number;
  tokenOutDecimals: number;
  rate: FixedNumber; // an adjusted rate, in the biggest units of token out.
}

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

// Returns a rate in the biggest units of destination token not the smallest units.
export function adjustRate(rate: Price<Token, Token>): FixedNumber {
  let fraction = new Fraction(rate.numerator, rate.denominator);
  return FixedNumber.from(fraction.multiply(rate.scalar).toSignificant(6));
}

async function getTokenPairRate(
  provider: JsonRpcProvider,
  tokenInAddress: string,
  tokenOutAddress: string
): Promise<Price<Token, Token>> {
  let network = await provider.getNetwork();
  let tokenIn = await fetchTokenData(network.chainId, tokenInAddress, provider as unknown as BaseProvider);
  let tokenOut = await fetchTokenData(network.chainId, tokenOutAddress, provider as unknown as BaseProvider);

  let networkName = convertChainIdToName(network.chainId);
  let uniswapV2Factory = getAddressByNetwork('uniswapV2Factory', networkName);
  let initCodeHash = getConstantByNetwork('uniswapPairInitCodeHash', networkName as SchedulerCapableNetworks);
  let pair = await fetchPairData(tokenIn, tokenOut, uniswapV2Factory, initCodeHash, provider);

  let route = new Route([pair], tokenIn, tokenOut);

  return route.midPrice; // How many "token 1" we can get for one "token 2" in Uniswap
}

/**
 * @group Utils
 * @category Conversion
 */
export async function gasPriceInToken(provider: JsonRpcProvider, tokenAddress: string): Promise<BN> {
  let network = await networkName(provider);
  let chainId = (await provider.getNetwork()).chainId;

  // Gas station will return current gas price in native units of the token.
  let gasPriceInNativeTokenInWei = new BN((await getGasPricesInNativeWei(chainId)).standard.toString());

  // We use the wrapped native token address because the native token doesn't have an address in Uniswap.
  // The price of the wrapped native token, such as WETH, is the same as the price of the native token.
  let wrappedNativeToken = getAddressByNetwork('wrappedNativeToken', network);
  if (tokenAddress === wrappedNativeToken) {
    return gasPriceInNativeTokenInWei;
  }

  let rate = await getTokenPairRate(provider, wrappedNativeToken, tokenAddress);
  let rateFraction = new Fraction(rate.numerator, rate.denominator).multiply(rate.scalar);
  let rateBN = new BN(rateFraction.numerator.toString()).div(new BN(rateFraction.denominator.toString()));

  // Since tokens can have different decimals, we need to use the scalar's denominator and numerator to adjust the rate
  return rateBN
    .mul(gasPriceInNativeTokenInWei)
    .mul(new BN(rate.scalar.denominator.toString())) // scalar's denominator 10**(decimals of given token), for example 10**6 for USDC
    .div(new BN(rate.scalar.numerator.toString())); // scalar's numerator is 10**(decimals of native token), for example 10**18 for ETH
}

/**
 * @group Utils
 * @category Conversion
 */
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

/**
 * @group Utils
 * @category Conversion
 * @example
 * ```ts
 * provider.getNetwork().chainId: 1 (Mainnet)
 * tokenAddress: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 (USDC)
 * result:
 * {
 *   tokenInAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", (WETH)
 *   tokenOutAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", (USDC)
 *   tokenInDecimals: 18,
 *   tokenOutDecimals: 6,
 *   rate: 1716.06, (1 ETH = 1716.06 USDC) => (1 x (10^18) WEI = 1716.06 x (10^6) USDC (in the smallest units))
 * };
 * ```
 */
export async function getNativeToTokenRate(provider: JsonRpcProvider, tokenAddress: string): Promise<TokenPairRate> {
  let network = await networkName(provider);
  let wrappedNativeTokenAddress = getAddressByNetwork('wrappedNativeToken', network);
  let wrappedNativeToken = new Contract(wrappedNativeTokenAddress, ERC20ABI, provider);
  let token = new Contract(tokenAddress, ERC20ABI, provider);
  let tokenPairRate = {
    tokenInAddress: wrappedNativeTokenAddress,
    tokenOutAddress: tokenAddress,
    tokenInDecimals: await wrappedNativeToken.callStatic.decimals(),
    tokenOutDecimals: await token.callStatic.decimals(),
    rate: FixedNumber.from(1),
  };

  if (wrappedNativeTokenAddress.toLowerCase() !== tokenAddress.toLowerCase()) {
    tokenPairRate.rate = adjustRate(await getTokenPairRate(provider, wrappedNativeTokenAddress, tokenAddress));
  }

  return tokenPairRate;
}

/**
 * @group Utils
 * @category Conversion
 * @example
 * ```ts
 * provider.getNetwork().chainId: 1 (Mainnet)
 * tokenAddress: 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 (WETH)
 * result:
 * {
 *   tokenInAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", (USDC)
 *   tokenOutAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", (WETH)
 *   tokenInDecimals: 6,
 *   tokenOutDecimals: 18,
 *   rate: 0.000583026, (1 USDC = 0.000583026 ETH) => (1 x (10^6) USDC (in the smallest units) = 0.000583026 x (10^18) WEI)
 * };
 * ```
 */

export async function getUsdcToTokenRate(provider: JsonRpcProvider, tokenAddress: string): Promise<TokenPairRate> {
  let network = await networkName(provider);
  let usdcAddress = getAddressByNetwork('usdStableCoinToken', network);
  let usdc = new Contract(usdcAddress, ERC20ABI, provider);
  let token = new Contract(tokenAddress, ERC20ABI, provider);
  let tokenPairRate = {
    tokenInAddress: usdcAddress,
    tokenOutAddress: tokenAddress,
    tokenInDecimals: await usdc.callStatic.decimals(),
    tokenOutDecimals: await token.callStatic.decimals(),
    rate: FixedNumber.from(1),
  };

  if (usdcAddress.toLowerCase() !== tokenAddress.toLowerCase()) {
    tokenPairRate.rate = adjustRate(await getTokenPairRate(provider, usdcAddress, tokenAddress));
  }

  return tokenPairRate;
}

/**
 * @group Utils
 * @category Conversion
 * @returns an amount in the smallest units of output token
 *
 * if invert false, amount is the value of tokenIn in the smallest units
 * else amount is the value of tokenOut in the smallest units
 */
export function applyRateToAmount(tokenRate: TokenPairRate, amount: BigNumber, invert = false): BigNumber {
  if (amount.isZero()) {
    return BigNumber.from(0);
  }
  let ten = BigNumber.from(10);
  let tokenInSmallestUnits = ten.pow(tokenRate.tokenInDecimals);
  let tokenOutSmallestUnits = ten.pow(tokenRate.tokenOutDecimals);
  if (invert) {
    return amount
      .mul(tokenInSmallestUnits)
      .div(BigNumber.from(tokenRate.rate.mulUnsafe(FixedNumber.from(tokenOutSmallestUnits)).toString().split('.')[0]));
  }
  return BigNumber.from(
    tokenRate.rate
      .mulUnsafe(FixedNumber.from(amount))
      .mulUnsafe(FixedNumber.from(tokenOutSmallestUnits))
      .toString()
      .split('.')[0]
  ).div(tokenInSmallestUnits);
}
