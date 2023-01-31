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
    });
  });
});
