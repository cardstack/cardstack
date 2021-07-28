import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { inject } from '@ember/service';
import CardsService from '../services/cards';
import ModalService from 'cardhost/services/modal';

export default class ApplicationController extends Controller {
  @inject declare cards: CardsService;
  @inject declare modal: ModalService;

  queryParams = ['url'];

  @tracked url: string | undefined;
}
