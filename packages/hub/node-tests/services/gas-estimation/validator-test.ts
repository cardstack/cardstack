import { GasEstimationResultsScenarioEnum } from '@prisma/client';
import { GasEstimationParams } from '../../../services/gas-estimation';
import GasEstimationValidator from '../../../services/validators/gas-estimation';
import { setupHub } from '../../helpers/server';

describe('GasEstimationValidator', function () {
  let subject: GasEstimationValidator;
  let { getContainer } = setupHub(this);

  this.beforeEach(async function () {
    subject = (await getContainer().lookup('gas-estimation-validator')) as GasEstimationValidator;
  });

  it('validates gas estimation with missing attrs', async function () {
    const gasEstimationParams: Partial<GasEstimationParams> = {};

    let errors = await subject.validate(gasEstimationParams);
    expect(errors).deep.equal({
      scenario: ['scenario is required'],
      chainId: ['chain id is required'],
      safeAddress: [],
    });
  });

  it('validates gas estimation with missing attr for execution scenario', async function () {
    const gasEstimationParams: Partial<GasEstimationParams> = {
      scenario: GasEstimationResultsScenarioEnum.execute_one_time_payment,
      chainId: 1,
    };

    let errors = await subject.validate(gasEstimationParams);
    expect(errors).deep.equal({
      scenario: [],
      chainId: [],
      safeAddress: [
        `safe address is required in ${GasEstimationResultsScenarioEnum.execute_one_time_payment} scenario`,
      ],
    });
  });

  it('validates gas estimation for execution scenario with wrong address format', async function () {
    const gasEstimationParams: Partial<GasEstimationParams> = {
      scenario: GasEstimationResultsScenarioEnum.execute_one_time_payment,
      chainId: 1,
      safeAddress: 'wrong address',
    };

    let errors = await subject.validate(gasEstimationParams);
    expect(errors).deep.equal({
      scenario: [],
      chainId: [],
      safeAddress: [`safe address is not a valid address`],
    });
  });
});
