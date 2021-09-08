import { tracked } from '@glimmer/tracking';
import { getResolver } from '@cardstack/did-resolver';
import { Resolver } from 'did-resolver';
import { Resource } from 'ember-resources';
import * as Sentry from '@sentry/browser';
import {
  fetchOffChainJson,
  isStorage404,
} from '@cardstack/web-client/utils/fetch-off-chain-json';

interface Args {
  named: {
    infoDID: string;
    waitForInfo: boolean;
  };
}

export class MerchantInfo extends Resource<Args> {
  @tracked id: string | undefined;
  @tracked name: string | undefined;
  @tracked backgroundColor: string | undefined;
  @tracked textColor: string | undefined;

  @tracked loading = true;
  @tracked errored: Error | undefined;

  #didResolver = new Resolver(getResolver());

  constructor(owner: unknown, args: Args) {
    super(owner, args);
    this.run();
  }

  private async run() {
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
    let did = await this.#didResolver.resolve(infoDID);
    let alsoKnownAs = did?.didDocument?.alsoKnownAs;

    if (alsoKnownAs) {
      let jsonApiDocument = await fetchOffChainJson(
        alsoKnownAs[0],
        waitForInfo
      );

      this.id = jsonApiDocument.data.attributes['slug'];
      this.name = jsonApiDocument.data.attributes['name'];
      this.backgroundColor = jsonApiDocument.data.attributes['color'];
      this.textColor = jsonApiDocument.data.attributes['text-color'];
    }
  }
}
