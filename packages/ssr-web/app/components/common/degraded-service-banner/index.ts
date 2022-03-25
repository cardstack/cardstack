import { inject as service } from '@ember/service';
import DegradedServiceDetector from '@cardstack/ssr-web/services/degraded-service-detector';
import { reads } from 'macro-decorators';
import Component from '@glimmer/component';

export default class DegradedServiceBannerComponent extends Component {
  @service declare degradedServiceDetector: DegradedServiceDetector;

  @reads('degradedServiceDetector.notificationShown')
  declare notificationShown: boolean;
  @reads('degradedServiceDetector.body') declare body: string | null;
  @reads('degradedServiceDetector.title') declare title: string | null;
  @reads('degradedServiceDetector.isSevere') declare isSevere: boolean;
}
