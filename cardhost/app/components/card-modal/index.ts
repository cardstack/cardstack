import Component from '@glimmer/component';
import { inject } from '@ember/service';
import ModalService from 'cardhost/services/modal';
import { action } from '@ember/object';

export default class CardModal extends Component {
  @inject declare modal: ModalService;

  @action close(): void {
    this.modal.close();
  }
}
