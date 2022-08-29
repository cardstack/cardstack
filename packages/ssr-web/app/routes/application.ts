import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import Fastboot from 'ember-cli-fastboot/services/fastboot';
import { Profile } from '../resources/profile';
import ProfileService from '@cardstack/ssr-web/services/profile';
import { isTesting } from '@embroider/macros';
import { getSentry } from '../utils/sentry';
import { action } from '@ember/object';
import Transition from '@ember/routing/-private/transition';
import { NotFoundError } from './not-found';

export default class ApplicationRoute extends Route {
  @service('profile') declare profile: ProfileService;
  @service declare fastboot: Fastboot;
  sentry = getSentry();

  async model(): Promise<Profile | undefined> {
    if (this.profile.isActive) {
      let model = this.profile.model;
      await model.run();

      if (model.is404) {
        if (this.fastboot.isFastBoot) {
          this.fastboot.response.statusCode = 404;
        }
        let e = new Error(`404: card.xyz not found for ${this.profile.slug}`);

        // @ts-ignore
        e.isMissingCardSpace = true;

        throw e;
      }

      return model;
    } else {
      return undefined;
    }
  }

  afterModel() {
    if (!isTesting() && !this.fastboot.isFastBoot) {
      console.warn(
        '%cBe careful!',
        'color: red; font-size: 20px;   font-weight: bold;'
      );
      console.warn('Never run commands here that you don’t understand.');
    }
  }

  @action error(error: any, _transition: Transition<unknown>): true {
    // Handle uncaught errors and then bubble them up so they can be handled
    // by the application error route
    if (error != NotFoundError) {
      this.sentry.captureException(error);
    }
    return true;
  }
}
