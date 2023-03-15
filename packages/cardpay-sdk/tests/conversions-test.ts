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
describe.only('applyRateToAmount', () => {
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
});
