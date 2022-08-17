import { tracked } from '@glimmer/tracking';
import { Resource } from 'ember-resources';
import OffChainJsonService from '../services/off-chain-json';
import { inject as service } from '@ember/service';
import { isStorage404 } from '@cardstack/ssr-web/utils/fetch-off-chain-json';
import config from '@cardstack/ssr-web/config/environment';
import { getSentry } from '../utils/sentry';

interface Args {
  named: {
    slug?: string;
    infoDID?: string;
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
  @tracked infoDID: string | undefined;
  @tracked waitForInfo = false;

  @tracked loading = true;
  @tracked errored: Error | undefined;
  @tracked is404 = false;
  @service declare offChainJson: OffChainJsonService;
  sentry = getSentry();

  modify(
    _positional: any,
    { infoDID, slug }: { infoDID?: string; slug?: string }
  ) {
    this.infoDID = infoDID;
    this.slug = slug;
  }

  async run() {
    if (this.infoDID) {
      try {
        await this.fetchProfileViaS3();
        this.loading = false;
      } catch (err) {
        this.errored = err;
        this.loading = false;

        if (!isStorage404(err)) {
          console.log('Exception fetching merchant info', err);
          this.sentry.captureException(err);
        }
      }

      return;
    }

    try {
      await this.fetchProfileViaAPI(this.slug!);
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

  private async fetchProfileViaAPI(slug: string) {
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

  private async fetchProfileViaS3(): Promise<void> {
    let jsonApiDocument = await this.offChainJson.fetch(
      this.infoDID,
      this.waitForInfo
    );

    if (jsonApiDocument) {
      this.id = jsonApiDocument.data.attributes['slug'];
      this.name = jsonApiDocument.data.attributes['name'];
      this.backgroundColor = jsonApiDocument.data.attributes['color'];
      this.textColor = jsonApiDocument.data.attributes['text-color'];
    }
  }
}
