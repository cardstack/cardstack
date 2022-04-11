import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import CardSpaceService from '../services/card-space';

export default class ApplicationController extends Controller {
  @service('card-space') declare cardSpace: CardSpaceService;
}
