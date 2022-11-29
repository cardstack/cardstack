import { convertChainIdToName } from '@cardstack/cardpay-sdk';
import { NotFound } from '@cardstack/core/src/utils/errors';
import { nowUtc } from '../../utils/dates';
import { registry, setupHub } from '../helpers/server';

const result = {
  id: '1',
  chainId: 1,
  slow: '1000000000',
  standard: '2000000000',
  fast: '3000000000',
  createdAt: nowUtc().toUTCString(),
  updatedAt: nowUtc().toUTCString(),
};

let isRequestSuccess = true;

class StubGasStationService {
  async getGasPriceByChainId(chainId: number) {
    let networkName = convertChainIdToName(chainId);
    if (!networkName) {
      throw new NotFound(`Unsupported network: ${chainId}`);
    }

    if (!isRequestSuccess) {
      throw new Error(`Cannot retrieve gas price from gas station`);
    }

    return result;
  }
}

describe('GET /api/gas-station', async function () {
  this.beforeEach(async function () {
    registry(this).register('gas-station-service', StubGasStationService);
  });

  let { request } = setupHub(this);

  it('returns gas price', async function () {
    await request()
      .get('/api/gas-station/1')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        data: {
          id: result.id,
          type: 'gas-prices',
          attributes: {
            'chain-id': result.chainId,
            slow: result.slow,
            standard: result.standard,
            fast: result.fast,
          },
        },
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('returns 404 if chain id is not supported', async function () {
    await request()
      .get('/api/gas-station/0')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(404)
      .expect(`Unsupported network: 0`);
  });

  it('returns 500 if cannot retrieve from gas station', async function () {
    isRequestSuccess = false;
    await request()
      .get('/api/gas-station/1')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(500);
    isRequestSuccess = true;
  });
});
