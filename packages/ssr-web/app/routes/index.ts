import Route from '@ember/routing/route';
import config from '@cardstack/ssr-web/config/environment';
import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { LocationService } from '../services/location';
import Fastboot from 'ember-cli-fastboot/services/fastboot';

export default class IndexRoute extends Route {
  @service declare location: LocationService;
  @service declare fastboot: Fastboot;
  cardSpaceId = '';

  model(params: any) {
    this.cardSpaceId = params['cardSpaceId'];
  }

  getCardSpaceId() {
    if (this.fastboot.isFastBoot) {
      if (this.fastboot.request.queryParams.cardSpaceId) {
        return this.fastboot.request.queryParams.cardSpaceId;
      } else if (
        this.fastboot.request.host.endsWith(config.cardSpaceHostnameSuffix)
      ) {
        return this.fastboot.request.host.replace(
          `.${config.cardSpaceHostnameSuffix}`,
          ''
        );
      }
    } else if (
      !this.fastboot.isFastBoot &&
      this.location.hostname.endsWith(config.cardSpaceHostnameSuffix)
    ) {
      return this.location.hostname.replace(
        `.${config.cardSpaceHostnameSuffix}`,
        ''
      );
    } else if (this.cardSpaceId) {
      return this.cardSpaceId;
    }
  }

  renderTemplate(controller: Controller) {
    let cardSpaceId = this.getCardSpaceId();
    //@ts-ignore
    if (cardSpaceId) {
      let displayName = cardSpaceId;
      // FIXME currently not possible…?
      // if (config.environment === 'development') {
      //   displayName = this.cardSpaceId;
      //   if (!displayName) {
      //     throw new Error(
      //       'card-space-id query parameter is required for card space user page in development'
      //     );
      //   }
      // } else {
      //   displayName = this.location.hostname.replace(
      //     `.${config.cardSpaceHostnameSuffix}`,
      //     ''
      //   );
      // }

      // this.render('card-space', {
      //   into: 'application',
      // });
      this.render('view-card-space', {
        into: 'card-space',
        model: { displayName },
      });
    } else {
      super.renderTemplate(controller, null);
    }
  }
}
