import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import BN from 'bn.js';
import fetch from 'node-fetch';
import { getGasPricesInNativeWei } from '../sdk/utils/conversions';

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
