import { timeout } from 'ember-concurrency';
import { tracked } from '@glimmer/tracking';
import { getResolver } from '@cardstack/did-resolver';
import { Resolver } from 'did-resolver';
import { Resource } from 'ember-resources';
import config from '../config/environment';

const FIRST_RETRY_DELAY = config.environment === 'test' ? 100 : 1000;

interface Args {
  named: {
    customizationDID: string;
    waitForCustomization: boolean;
  };
}

export class CardCustomization extends Resource<Args> {
  // our output values
  @tracked issuerName: string | undefined;
  @tracked background: string | undefined;
  @tracked patternColor: string | undefined;
  @tracked textColor: string | undefined;
  @tracked patternUrl: string | undefined;

  // our derived state so you can check when the output values are ready, if you
  // want to
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
        this.args.named.customizationDID,
        this.args.named.waitForCustomization
      );
      this.loading = false;
    } catch (err) {
      this.errored = err;
      this.loading = false;
    }
  }

  private async fetchCardCustomization(
    customizationDID: string,
    waitForCustomization = false
  ): Promise<void> {
    let did = await this.#didResolver.resolve(customizationDID);

    let alsoKnownAs = did?.didDocument?.alsoKnownAs;

    if (alsoKnownAs) {
      let jsonApiDocument = await this.fetchJson(
        alsoKnownAs[0], // FIXME: the original code had a type error here that was hiding
        waitForCustomization
      );

      let included = jsonApiDocument.included;

      let colorScheme = included.findBy('type', 'prepaid-card-color-schemes')
        .attributes;
      let pattern = included.findBy('type', 'prepaid-card-patterns').attributes;

      this.issuerName = jsonApiDocument.data.attributes['issuer-name'];
      this.background = colorScheme.background;
      this.patternColor = colorScheme['pattern-color'];
      this.textColor = colorScheme['text-color'];
      this.patternUrl = pattern['pattern-url'];
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
          let errorBodyText = await jsonApiResponse.text();
          throw new Error(errorBodyText);
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
