import Koa from 'koa';
import autoBind from 'auto-bind';
import { inject } from '@cardstack/di';
import { GasEstimationParams } from '../services/gas-estimation';
import { serializeErrors } from './utils/error';

export default class GasEstimationRoute {
  gasEstimationService = inject('gas-estimation-service', { as: 'gasEstimationService' });
  gasEstimationValidator = inject('gas-estimation-validator', { as: 'gasEstimationValidator' });
  gasEstimationResultSerializer = inject('gas-estimation-result-serializer', { as: 'gasEstimationResultSerializer' });

  constructor() {
    autoBind(this);
  }

  async get(ctx: Koa.Context) {
    let attrs = ctx.request.body.data.attributes;
    let params = {
      scenario: attrs['scenario'],
      chainId: attrs['chain-id'],
      tokenAddress: attrs['token-address'],
      gasTokenAddress: attrs['gas-token-address'],
      scheduledPaymentType: attrs['scheduled-payment-type'],
    } as unknown as GasEstimationParams;
    let errors = await this.gasEstimationValidator.validate(params);
    let hasErrors = Object.values(errors).flatMap((i) => i).length > 0;
    if (hasErrors) {
      ctx.status = 422;
      ctx.body = {
        errors: serializeErrors(errors),
      };
      return;
    }

    let gasPrice = await this.gasEstimationService.estimate(params);
    ctx.status = 200;
    ctx.body = this.gasEstimationResultSerializer.serialize(gasPrice);
    ctx.type = 'application/vnd.api+json';
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'gas-estimation-route': GasEstimationRoute;
  }
}
