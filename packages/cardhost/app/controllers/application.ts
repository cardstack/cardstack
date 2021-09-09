import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { inject } from '@ember/service';
import CardsService from '../services/cards';
import ModalService from 'cardhost/services/modal';
import { action } from '@ember/object';
import { Format } from '@cardstack/core/src/interfaces';

export default class ApplicationController extends Controller {
  @inject declare cards: CardsService;
  @inject declare modal: ModalService;

  queryParams = ['url', 'format'];

  @tracked url: string | undefined;
  @tracked format: Format | undefined;

  @action onModalClose(): void {
    this.url = undefined;
    this.format = undefined;
  }
}
