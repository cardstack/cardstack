import { timeout } from 'ember-concurrency';
import { tracked } from '@glimmer/tracking';
import { getResolver } from '@cardstack/did-resolver';
import { Resolver } from 'did-resolver';
import { Resource } from 'ember-resources';
import config from '../config/environment';
import * as Sentry from '@sentry/browser';

const FIRST_RETRY_DELAY = config.environment === 'test' ? 100 : 1000;

class Storage404 extends Error {}

interface Args {
  named: {
    infoDID: string;
    waitForCustomization: boolean;
  };
}

export class MerchantCustomization extends Resource<Args> {
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
      await this.fetchCardCustomization(
        this.args.named.infoDID,
        this.args.named.waitForCustomization
      );
      this.loading = false;
    } catch (err) {
      this.errored = err;
      this.loading = false;

      if (!(err instanceof Storage404)) {
        console.log('Exception fetching merchant customization', err);
        Sentry.captureException(err);
      }
    }
  }

  private async fetchCardCustomization(
    infoDID: string,
    waitForCustomization = false
  ): Promise<void> {
    let did = await this.#didResolver.resolve(infoDID);
    let alsoKnownAs = did?.didDocument?.alsoKnownAs;

    if (alsoKnownAs) {
      let jsonApiDocument = await this.fetchJson(
        alsoKnownAs[0],
        waitForCustomization
      );
      console.log('json', jsonApiDocument);

      this.id = jsonApiDocument.data.attributes['slug'];
      this.name = jsonApiDocument.data.attributes['name'];
      this.backgroundColor = jsonApiDocument.data.attributes['color'];
      this.textColor = jsonApiDocument.data.attributes['text-color'];
    }
  }

  private async fetchJson(
    alsoKnownAs: string,
    waitForCustomization: boolean
  ): Promise<any> {
    let maxAttempts = waitForCustomization ? 10 : 1;
    let attemptNum = 1;
    while (attemptNum <= maxAttempts) {
      try {
        let jsonApiResponse = await fetch(alsoKnownAs);
        if (!jsonApiResponse.ok) {
          if (jsonApiResponse.status === 403) {
            throw new Storage404();
          } else {
            let errorBodyText = await jsonApiResponse.text();
            throw new Error(errorBodyText);
          }
        }
        let jsonApiDocument = await jsonApiResponse.json();
        return jsonApiDocument;
      } catch (err) {
        if (attemptNum === maxAttempts) {
          throw err;
        }
        attemptNum++;
        await timeout(FIRST_RETRY_DELAY * attemptNum);
      }
    }
  }
}
