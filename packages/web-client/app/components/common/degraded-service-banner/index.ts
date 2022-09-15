import { inject as service } from '@ember/service';
import DegradedServiceDetector from '@cardstack/web-client/services/degraded-service-detector';
import { reads } from 'macro-decorators';
import Component from '@glimmer/component';
import { type EmptyObject } from '@ember/component/helper';

interface Signature {
  Element: HTMLDivElement;
  Args: EmptyObject;
  Blocks: EmptyObject;
}
export default class DegradedServiceBannerComponent extends Component<Signature> {
  @service declare degradedServiceDetector: DegradedServiceDetector;

  @reads('degradedServiceDetector.notificationShown')
  declare notificationShown: boolean;
  @reads('degradedServiceDetector.notificationBody') declare notificationBody:
    | string
    | null;
  @reads('degradedServiceDetector.isSevere') declare isSevere: boolean;
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Common::DegradedServiceBanner': typeof DegradedServiceBannerComponent;
  }
}
