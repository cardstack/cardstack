import config from '@cardstack/web-client/config/environment';
import { inject as service } from '@ember/service';
import DegradedServiceDetector from '@cardstack/web-client/services/degraded-service-detector';
import { reads } from 'macro-decorators';
import Component from '@glimmer/component';

export default class DegradedServiceBannerComponent extends Component {
  statusPageBase = config.urls.statusPageBase;
  @service declare degradedServiceDetector: DegradedServiceDetector;

  @reads('degradedServiceDetector.notificationShown')
  declare notificationShown: boolean;
  @reads('degradedServiceDetector.notificationBody') declare notificationBody:
    | string
    | null;
  @reads('degradedServiceDetector.isSevere') declare isSevere: boolean;
}
