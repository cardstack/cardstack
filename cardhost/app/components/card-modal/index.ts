import Component from '@glimmer/component';
import { inject } from '@ember/service';
import ModalService from 'cardhost/services/modal';
import { action } from '@ember/object';
import './index.css';
import { Format } from '../../../../core/src/interfaces';

export default class CardModal extends Component<{
  url: string;
  format?: Format;
  onClose: Function;
}> {
  @inject declare modal: ModalService;

  @action updateModal(): void {
    if (this.args.url) {
      this.modal.openCard(this.args.url, this.args.format || 'isolated');
    } else if (this.modal.isShowing) {
      this.modal.close();
    }
  }

  @action close(): void {
    this.modal.close();
    this.args.onClose();
  }
}
