import { tracked } from '@glimmer/tracking';
import { Resource } from 'ember-resources';
import * as Sentry from '@sentry/browser';
import { isStorage404 } from '@cardstack/ssr-web/utils/fetch-off-chain-json';
import OffChainJsonService from '../services/off-chain-json';
import { inject as service } from '@ember/service';

interface Args {
  named: {
    customizationDID: string;
    waitForCustomization: boolean;
  };
}

export class CardCustomization extends Resource<Args> {
  @tracked issuerName: string | undefined;
  @tracked background: string | undefined;
  @tracked patternColor: string | undefined;
  @tracked textColor: string | undefined;
  @tracked patternUrl: string | undefined;

  @tracked loading = true;
  @tracked errored: Error | undefined;

  @service declare offChainJson: OffChainJsonService;

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

      if (!isStorage404(err)) {
        console.log('Exception fetching card customization', err);
        Sentry.captureException(err);
      }
    }
  }

  private async fetchCardCustomization(
    customizationDID: string,
    waitForCustomization = false
  ): Promise<void> {
    let jsonApiDocument = await this.offChainJson.fetch(
      customizationDID,
      waitForCustomization
    );

    if (jsonApiDocument) {
      let { included } = jsonApiDocument;

      let colorScheme = included.findBy(
        'type',
        'prepaid-card-color-schemes'
      ).attributes;
      let pattern = included.findBy('type', 'prepaid-card-patterns').attributes;

      this.issuerName = jsonApiDocument.data.attributes['issuer-name'];
      this.background = colorScheme.background;
      this.patternColor = colorScheme['pattern-color'];
      this.textColor = colorScheme['text-color'];
      this.patternUrl = pattern['pattern-url'];
    }
  }
}
