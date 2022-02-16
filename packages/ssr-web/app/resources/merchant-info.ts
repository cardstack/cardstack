import { tracked } from '@glimmer/tracking';
import { Resource } from 'ember-resources';
import * as Sentry from '@sentry/browser';
import OffChainJsonService from '../services/off-chain-json';
import { inject as service } from '@ember/service';
import { isStorage404 } from '@cardstack/ssr-web/utils/fetch-off-chain-json';

interface Args {
  named: {
    infoDID: string;
    waitForInfo: boolean;
  };
}

export interface MerchantInfoResource {
  id: string | undefined;
  name: string | undefined;
  backgroundColor: string | undefined;
  textColor: string | undefined;
  loading: boolean;
  errored: Error | undefined;
}

export class MerchantInfo
  extends Resource<Args>
  implements MerchantInfoResource
{
  @tracked id: string | undefined;
  @tracked name: string | undefined;
  @tracked backgroundColor: string | undefined;
  @tracked textColor: string | undefined;

  @tracked loading = true;
  @tracked errored: Error | undefined;

  @service declare offChainJson: OffChainJsonService;

  constructor(owner: unknown, args: Args) {
    super(owner, args);
  }

  async run() {
    try {
      await this.fetchMerchantInfo(
        this.args.named.infoDID,
        this.args.named.waitForInfo
      );
      this.loading = false;
    } catch (err) {
      this.errored = err;
      this.loading = false;

      if (!isStorage404(err)) {
        console.log('Exception fetching merchant info', err);
        Sentry.captureException(err);
      }
    }
  }

  private async fetchMerchantInfo(
    infoDID: string,
    waitForInfo = false
  ): Promise<void> {
    let jsonApiDocument = await this.offChainJson.fetch(infoDID, waitForInfo);

    if (jsonApiDocument) {
      this.id = jsonApiDocument.data.attributes['slug'];
      this.name = jsonApiDocument.data.attributes['name'];
      this.backgroundColor = jsonApiDocument.data.attributes['color'];
      this.textColor = jsonApiDocument.data.attributes['text-color'];
    }
  }
}
