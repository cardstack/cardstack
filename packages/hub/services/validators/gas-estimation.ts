import { GasEstimationResultsScenarioEnum } from '@prisma/client';
import { startCase } from 'lodash';
import { inject } from '@cardstack/di';
import { GasEstimationParams } from '../gas-estimation';
import { isSupportedChain } from '@cardstack/cardpay-sdk';

type GasEstimationAttribute = 'scenario' | 'chainId';

type GasEstimationErrors = Record<GasEstimationAttribute, string[]>;

export default class GasEstimationValidator {
  cardpay = inject('cardpay');

  async validate(gasEstimationParams: Partial<GasEstimationParams>): Promise<GasEstimationErrors> {
    let errors: GasEstimationErrors = {
      scenario: [],
      chainId: [],
    };

    let mandatoryAttributes: GasEstimationAttribute[] = ['scenario', 'chainId'];

    for (let attribute of mandatoryAttributes) {
      if (gasEstimationParams[attribute] == null) {
        errors[attribute].push(`${startCase(attribute).toLowerCase()} is required`);
      }
    }

    if (
      gasEstimationParams.scenario &&
      !Object.values(GasEstimationResultsScenarioEnum).includes(gasEstimationParams.scenario)
    ) {
      errors.scenario.push(
        `scenario must be one of these values: ${Object.values(GasEstimationResultsScenarioEnum).join(',')}`
      );
    }

    if (gasEstimationParams.chainId && !isSupportedChain(gasEstimationParams.chainId)) {
      errors.chainId.push(`chain is not supported`);
    }

    return errors;
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'gas-estimation-validator': GasEstimationValidator;
  }
}
