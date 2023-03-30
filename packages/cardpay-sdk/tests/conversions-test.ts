import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import BN from 'bn.js';
import fetch from 'node-fetch';
import { applyRateToAmount, getGasPricesInNativeWei, TokenPairRate } from '../sdk/utils/conversions';
import { BigNumber, FixedNumber } from 'ethers';

if (!globalThis.fetch) {
  //@ts-ignore polyfilling fetch
  globalThis.fetch = fetch;
}

chai.use(chaiAsPromised);

const attributes = { 'chain-id': 1, slow: '12000000000', standard: '12000000000', fast: '15000000000' };

describe('getGasPricesInNativeWei', () => {
  const server = setupServer(
    rest.get('https://hub.cardstack.com/api/gas-station/1', (_req, res, ctx) =>
      res(
        ctx.json({
          data: {
            id: 'bc3fda86-e287-403f-8e7d-ed31f14c012d',
            type: 'gas-prices',
            attributes,
          },
        })
      )
    )
  );

  before(() => {
    server.listen();
  });

  after(() => {
    server.close();
  });

  it('retrieves gas prices in native wei', async () => {
    const { fast, slow } = await getGasPricesInNativeWei(1);

    const expectedFast = new BN(attributes.fast).toString();
    const expectedSlow = new BN(attributes.slow).toString();

    chai.expect(fast).to.be.instanceOf(BN);
    chai.expect(fast.toString()).to.eq(expectedFast);
    chai.expect(slow.toString()).to.eq(expectedSlow);
  });
});

let token1Address = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
let token2Address = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const ten = BigNumber.from('10');

describe('applyRateToAmount', () => {
  let tokenPairRate: TokenPairRate;
  it('applies rate for two tokens with same decimals', () => {
    tokenPairRate = {
      tokenInAddress: token1Address,
      tokenOutAddress: token2Address,
      tokenInDecimals: 18,
      tokenOutDecimals: 18,
      rate: FixedNumber.from('1000'),
    };

    //invert: false
    //token1Amount: 2 x (10^18)
    chai
      .expect(applyRateToAmount(tokenPairRate, ten.pow(tokenPairRate.tokenInDecimals).mul('2'), false).toString())
      .to.eq(ten.pow(tokenPairRate.tokenInDecimals).mul('2').mul('1000').toString());

    //invert: true
    //token2Amount: 2 x (10^18)
    chai
      .expect(applyRateToAmount(tokenPairRate, ten.pow(tokenPairRate.tokenOutDecimals).mul('2'), true).toString())
      .to.eq(ten.pow(tokenPairRate.tokenOutDecimals).mul('2').div('1000').toString());
  });

  it('applies rate for two tokens with different decimals', () => {
    tokenPairRate = {
      tokenInAddress: token1Address,
      tokenOutAddress: token2Address,
      tokenInDecimals: 18,
      tokenOutDecimals: 6,
      rate: FixedNumber.from('1000'),
    };
    //invert: false
    //token1Amount: 2 x (10^6)
    chai
      .expect(applyRateToAmount(tokenPairRate, ten.pow(tokenPairRate.tokenInDecimals).mul('2'), false).toString())
      .to.eq(ten.pow(tokenPairRate.tokenOutDecimals).mul('2').mul('1000').toString());

    //invert: true
    //token2Amount: 2 x (10^18)
    chai
      .expect(applyRateToAmount(tokenPairRate, ten.pow(tokenPairRate.tokenOutDecimals).mul('2'), true).toString())
      .to.eq(ten.pow(tokenPairRate.tokenInDecimals).mul('2').div('1000').toString());
  });

  it('applies rate for two tokens with different decimals when conversion result is too low for the smallest unit', () => {
    // We are converting amount of WMATIC to USDC using the rate of 1.04902.
    // This means 1 WMATIC is worth 1.04902 USDC.
    let pairRate = {
      rate: FixedNumber.from('1.04902'),
      tokenInAddress: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
      tokenInDecimals: 18,
      tokenOutAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC
      tokenOutDecimals: 6,
    };

    let amount = BigNumber.from('1768028730'); // 0.000000001768029 WMATIC

    // Using the rate of 1.04902, we can calculate the amount of USDC that 0.000000001768029 WMATIC is worth.
    // We multiply the rate and the amount of WMATIC, and the result is 0.000000001854698 USDC.
    // To calculate the smallest unit representation using 6 decimals, we multiply the result by 10^6.
    // This comes to 0.001854698 in smallest units of USDC but this is below the minimum amount of the token in smallest units, which is 1.
    // We want to round this up to 1 in smallest units. With this test we want to avoid the common pitfall of
    // BigNumber divisions in conversion functions where the conversion result would be 0 in this case
    chai.expect(applyRateToAmount(pairRate, amount).toString()).to.eq('1');
  });
});
