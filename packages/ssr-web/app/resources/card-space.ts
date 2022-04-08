import { tracked } from '@glimmer/tracking';
import { Resource } from 'ember-resources';
import * as Sentry from '@sentry/browser';
import OffChainJsonService from '../services/off-chain-json';
import { inject as service } from '@ember/service';
import { isStorage404 } from '@cardstack/ssr-web/utils/fetch-off-chain-json';
import config from '@cardstack/ssr-web/config/environment';

interface Args {
  named: {
    slug: string;
  };
}

export interface CardSpaceResource {
  did: string | undefined;
  id: string | undefined;
  name: string | undefined;
  backgroundColor: string | undefined;
  ownerAddress: string | undefined;
  textColor: string | undefined;
  loading: boolean;
  errored: Error | undefined;
  is404: boolean;
}

export class CardSpace extends Resource<Args> implements CardSpaceResource {
  @tracked did: string | undefined;
  @tracked id: string | undefined;
  @tracked name: string | undefined;
  @tracked backgroundColor: string | undefined;
  @tracked textColor: string | undefined;
  @tracked ownerAddress: string | undefined;

  @tracked loading = true;
  @tracked errored: Error | undefined;
  @tracked is404 = false;

  @service declare offChainJson: OffChainJsonService;

  constructor(owner: unknown, args: Args) {
    super(owner, args);
  }

  async run() {
    try {
      await this.fetchCardSpace(this.args.named.slug);
    } catch (err) {
      this.errored = err;

      if (!isStorage404(err)) {
        console.log('Exception fetching merchant info', err);
        Sentry.captureException(err);
      }
    } finally {
      this.loading = false;
    }
  }

  private async fetchCardSpace(slug: string) {
    try {
      const response = await fetch(`${config.hubURL}/api/card-spaces/${slug}`, {
        method: 'GET',
        headers: {
          Accept: 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json',
        },
      });

      if (response.status === 404) {
        this.is404 = true;
        throw new Error(`404: Card Space not found for ${slug}`);
      }

      const cardSpaceResult: {
        included: any[];
      } = await response.json();

      let merchant = cardSpaceResult.included?.find(
        (v) => v.type === 'merchant-infos'
      );
      if (!merchant) {
        this.is404 = true;
        throw new Error(`404: Card Space not found for ${slug}`);
      }

      this.did = merchant.attributes['did'];
      this.id = merchant.attributes['slug'];
      this.name = merchant.attributes['name'];
      this.backgroundColor = merchant.attributes['color'];
      this.ownerAddress = merchant.attributes['owner-address'];
      this.textColor = merchant.attributes['text-color'];
    } catch (e) {
      Sentry.captureException(e);
      this.errored = e;
      throw e;
    }
  }
}
