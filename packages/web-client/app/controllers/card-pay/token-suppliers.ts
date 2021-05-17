import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';

export default class CardPayTokenSuppliersController extends Controller {
  queryParams = ['flow'];
  @tracked flow: 'issue-prepaid-card' | null = null;
}
