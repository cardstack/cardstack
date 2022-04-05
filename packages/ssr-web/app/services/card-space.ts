import Service from '@ember/service';
import { inject as service } from '@ember/service';
import Fastboot from 'ember-cli-fastboot/services/fastboot';
import { CardSpace } from '../resources/card-space';
import { useResource } from 'ember-resources';
import AppContextService from '@cardstack/ssr-web/services/app-context';

export default class CardSpaceService extends Service {
  @service('app-context') declare appContext: AppContextService;
  @service declare fastboot: Fastboot;

  cardSpace = useResource(this, CardSpace, () => ({
    named: {
      slug: this.appContext.cardSpaceId,
    },
  }));
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    'card-space': CardSpaceService;
  }
}
