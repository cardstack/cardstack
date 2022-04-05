import Service from '@ember/service';
import { inject as service } from '@ember/service';
import Fastboot from 'ember-cli-fastboot/services/fastboot';
import { CardSpace } from '../resources/card-space';
import { useResource } from 'ember-resources';
import AppContextService from '@cardstack/ssr-web/services/app-context';
import Layer2Network from './layer2-network';

export default class CardSpaceService extends Service {
  @service('app-context') declare appContext: AppContextService;
  @service declare fastboot: Fastboot;
  @service declare layer2Network: Layer2Network;

  model = useResource(this, CardSpace, () => ({
    named: {
      slug: this.slug,
    },
  }));

  get isActive() {
    return this.appContext.isCardSpace;
  }

  get slug() {
    return this.appContext.cardSpaceId;
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
    'card-space': CardSpaceService;
  }
}
