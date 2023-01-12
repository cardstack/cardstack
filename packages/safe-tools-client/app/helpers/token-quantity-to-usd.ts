import config from '@cardstack/safe-tools-client/config/environment';
import TokenToUsdService from '@cardstack/safe-tools-client/services/token-to-usd';
import Helper from '@ember/component/helper';
import { inject as service } from '@ember/service';
import { taskFor } from 'ember-concurrency-ts';

import TokenQuantity from '../utils/token-quantity';

type PositionalArgs = [TokenQuantity];

interface Signature {
  Args: {
    Positional: PositionalArgs;
  };
  Return: string | undefined;
}

const INTERVAL = config.environment === 'test' ? 1000 : 60 * 1000;

class TokenQuantityToUsdHelper extends Helper<Signature> {
  @service('token-to-usd') declare tokenToUsdService: TokenToUsdService;
  updateInterval: ReturnType<typeof setInterval> | undefined;

  compute([tokenQuantity]: PositionalArgs): string | undefined {
    if (!this.updateInterval) {
      this.updateInterval = setInterval(async () => {
        await taskFor(this.tokenToUsdService.updateUsdConverter).perform(
          tokenQuantity.token.address
        );
        this.recompute();
      }, INTERVAL);
    }

    return this.tokenToUsdService
      .toUsd(tokenQuantity.token.address, tokenQuantity.count)
      ?.toString();
  }

  willDestroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }
}

export default TokenQuantityToUsdHelper;
