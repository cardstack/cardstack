import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import Fastboot from 'ember-cli-fastboot/services/fastboot';
import { CardSpace } from '../resources/card-space';
import CardSpaceService from '@cardstack/ssr-web/services/card-space';

export default class ApplicationRoute extends Route {
  @service('card-space') declare cardSpace: CardSpaceService;
  @service declare fastboot: Fastboot;

  async model(): Promise<CardSpace | undefined> {
    if (this.cardSpace.isActive) {
      let model = this.cardSpace.model;
      await model.run();

      if (model.is404) {
        if (this.fastboot.isFastBoot) {
          this.fastboot.response.statusCode = 404;
        }
        throw new Error(`404: Card Space not found for ${this.cardSpace.slug}`);
      }

      return model;
    } else {
      return undefined;
    }
  }
}
