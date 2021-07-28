import Component from '@glimmer/component';
import { inject } from '@ember/service';
import ModalService from 'cardhost/services/modal';
import { action } from '@ember/object';
import './index.css';

export default class CardModal extends Component<{ url: string }> {
  @inject declare modal: ModalService;

  @action updateModal(): void {
    if (this.args.url) {
      this.modal.openCard(this.args.url, 'isolated');
    } else if (this.modal.isShowing) {
      this.modal.close();
    }
  }

  @action close(): void {
    this.modal.close();
  }
}
