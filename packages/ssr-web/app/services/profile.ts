import Service from '@ember/service';
import { inject as service } from '@ember/service';
import Fastboot from 'ember-cli-fastboot/services/fastboot';
import { Profile as Profile } from '../resources/profile';
import AppContextService from '@cardstack/ssr-web/services/app-context';
import Layer2Network from './layer2-network';

export default class ProfileService extends Service {
  @service('app-context') declare appContext: AppContextService;
  @service declare fastboot: Fastboot;
  @service declare layer2Network: Layer2Network;

  model = Profile.from(this, () => ({
    named: {
      slug: this.slug,
    },
  }));

  get isActive() {
    return this.appContext.currentApp === 'profile';
  }

  get slug() {
    return this.appContext.profileId;
  }

  get canEdit() {
    return this.layer2Network.walletInfo.accounts
      .mapBy('address')
      .includes(this.model.ownerAddress);
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    profile: ProfileService;
  }
}
