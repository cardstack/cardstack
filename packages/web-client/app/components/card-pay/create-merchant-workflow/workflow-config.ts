import config from '@cardstack/web-client/config/environment';
import { getConstantByNetwork } from '@cardstack/cardpay-sdk';

export const MERCHANT_CREATION_FEE_IN_SPEND =
  config.environment === 'test'
    ? 100
    : Number(
        getConstantByNetwork('merchantCreationFeeInSpend', config.chains.layer2)
      );
