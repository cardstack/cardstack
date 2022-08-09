import { tracked } from '@glimmer/tracking';
import { Resource } from 'ember-resources';
import * as Sentry from '@sentry/browser';
import OffChainJsonService from '../services/off-chain-json';
import { inject as service } from '@ember/service';
import { isStorage404 } from '@cardstack/web-client/utils/fetch-off-chain-json';

interface Args {
  named: {
    infoDID: string;
    waitForInfo: boolean;
  };
}

export interface ProfileResource {
  id: string | undefined;
  name: string | undefined;
  backgroundColor: string | undefined;
  textColor: string | undefined;
  loading: boolean;
  errored: Error | undefined;
}

export class Profile extends Resource<Args> implements ProfileResource {
  @tracked id: string | undefined;
  @tracked name: string | undefined;
  @tracked backgroundColor: string | undefined;
  @tracked textColor: string | undefined;

  @tracked loading = true;
  @tracked errored: Error | undefined;

  @service declare offChainJson: OffChainJsonService;

  modify(_positional: any, named: any) {
    this.run(named.infoDID, named.waitForInfo);
  }

  private async run(infoDID: string, waitForInfo: boolean) {
    try {
      await this.fetchProfile(infoDID, waitForInfo);
      this.loading = false;
    } catch (err) {
      this.errored = err;
      this.loading = false;

      if (!isStorage404(err)) {
        console.log('Exception fetching profile', err);
        Sentry.captureException(err);
      }
    }
  }

  private async fetchProfile(
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
