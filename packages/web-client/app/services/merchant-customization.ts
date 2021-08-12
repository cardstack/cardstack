import Service from '@ember/service';
import { task, TaskGenerator } from 'ember-concurrency';

export interface MerchantCustomization {
  did: string;
}

export default class MerchantCustomizationService extends Service {
  @task *createCustomizationTask(): TaskGenerator<MerchantCustomization> {
    yield () => {};

    return {
      did: 'PLACEHOLDER',
    };
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    'merchant-customization': MerchantCustomizationService;
  }
}
