import { GasEstimationResult, GasEstimationResultsScenarioEnum } from '@prisma/client';
import { GasEstimationParams } from '../../services/gas-estimation';
import { nowUtc } from '../../utils/dates';
import { registry, setupHub } from '../helpers/server';

let result: GasEstimationResult = {
  id: '1',
  scenario: GasEstimationResultsScenarioEnum.create_safe_with_module,
  chainId: 1,
  gas: 0,
  createdAt: nowUtc(),
  updatedAt: nowUtc(),
};

class StubGasEstimationService {
  async estimate(_gasEstimationParams: GasEstimationParams) {
    return result;
  }
}

describe('POST /api/gas-estimation', function () {
  this.beforeEach(async function () {
    registry(this).register('gas-estimation-service', StubGasEstimationService);
  });

  let { request } = setupHub(this);

  it('returns gas price for create a new safe scenario', async function () {
    result.scenario = GasEstimationResultsScenarioEnum.create_safe_with_module;
    result.gas = 8000000;

    await request()
      .post('/api/gas-estimation')
      .send({
        data: {
          attributes: {
            scenario: result.scenario,
            'chain-id': result.chainId,
          },
        },
      })
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        data: {
          id: result.id,
          type: 'gas-estimation-results',
          attributes: {
            scenario: result.scenario,
            'chain-id': result.chainId,
            gas: result.gas,
          },
        },
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('returns gas price for execute one-time payment scenario', async function () {
    result.scenario = GasEstimationResultsScenarioEnum.execute_one_time_payment;
    result.gas = 6000000;

    await request()
      .post('/api/gas-estimation')
      .send({
        data: {
          attributes: {
            scenario: result.scenario,
            'chain-id': result.chainId,
          },
        },
      })
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        data: {
          id: result.id,
          type: 'gas-estimation-results',
          attributes: {
            scenario: result.scenario,
            'chain-id': result.chainId,
            gas: result.gas,
          },
        },
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('returns gas price for execute recurring payment scenario', async function () {
    result.scenario = GasEstimationResultsScenarioEnum.execute_recurring_payment;
    result.gas = 6000000;

    await request()
      .post('/api/gas-estimation')
      .send({
        data: {
          attributes: {
            scenario: result.scenario,
            'chain-id': result.chainId,
          },
        },
      })
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        data: {
          id: result.id,
          type: 'gas-estimation-results',
          attributes: {
            scenario: result.scenario,
            'chain-id': result.chainId,
            gas: result.gas,
          },
        },
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('returns with errors when attrs are missing', async function () {
    result.gas = 6000000;

    await request()
      .post('/api/gas-estimation')
      .send({
        data: {
          attributes: {
            scenario: undefined,
            'chain-id': undefined,
          },
        },
      })
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(422)
      .expect({
        errors: [
          {
            detail: 'scenario is required',
            source: {
              pointer: '/data/attributes/scenario',
            },
            status: '422',
            title: 'Invalid attribute',
          },
          {
            detail: 'chain id is required',
            source: {
              pointer: '/data/attributes/chain-id',
            },
            status: '422',
            title: 'Invalid attribute',
          },
        ],
      });
  });
});
