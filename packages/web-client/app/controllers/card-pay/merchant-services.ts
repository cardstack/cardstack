import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';

export default class CardPayMerchantServicesController extends Controller {
  queryParams = ['flow'];
  @tracked flow: 'create-merchant' | null = null;
}
