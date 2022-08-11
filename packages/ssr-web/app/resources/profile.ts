import { tracked } from '@glimmer/tracking';
import { Resource } from 'ember-resources';
import OffChainJsonService from '../services/off-chain-json';
import { inject as service } from '@ember/service';
import { isStorage404 } from '@cardstack/ssr-web/utils/fetch-off-chain-json';
import config from '@cardstack/ssr-web/config/environment';
import { getSentry } from '../utils/sentry';

interface Args {
  named: {
    slug: string;
  };
}

export interface ProfileResource {
  did?: string | undefined;
  id: string | undefined;
  name: string | undefined;
  backgroundColor: string | undefined;
  ownerAddress?: string | undefined;
  textColor: string | undefined;
  loading: boolean;
  errored: Error | undefined;
  is404?: boolean;
}

export class Profile extends Resource<Args> implements ProfileResource {
  @tracked did: string | undefined;
  @tracked id: string | undefined;
  @tracked name: string | undefined;
  @tracked backgroundColor: string | undefined;
  @tracked textColor: string | undefined;
  @tracked ownerAddress: string | undefined;
  @tracked slug: string | undefined;

  @tracked loading = true;
  @tracked errored: Error | undefined;
  @tracked is404 = false;
  @service declare offChainJson: OffChainJsonService;
  sentry = getSentry();

  modify(_positional: any, { slug }: { slug: any }) {
    this.slug = slug;
  }
  async run() {
    try {
      await this.fetchProfile(this.slug!);
    } catch (err) {
      this.errored = err;

      if (!isStorage404(err)) {
        console.log('Exception fetching profile', err);
        this.sentry.captureException(err);
      }
    } finally {
      this.loading = false;
    }
  }

  private async fetchProfile(slug: string) {
    try {
      const response = await fetch(`${config.hubURL}/api/profiles/${slug}`, {
        method: 'GET',
        headers: {
          Accept: 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json',
        },
      });

      if (response.status === 404) {
        this.is404 = true;
        throw new Error(`404: Profile not found for ${slug}`);
      }

      const {
        data: { attributes },
      }: {
        data: { attributes: any };
      } = await response.json();

      this.did = attributes['did'];
      this.id = attributes['slug'];
      this.name = attributes['name'];
      this.backgroundColor = attributes['color'];
      this.ownerAddress = attributes['owner-address'];
      this.textColor = attributes['text-color'];
    } catch (e) {
      this.sentry.captureException(e);
      this.errored = e;
      throw e;
    }
  }
}
