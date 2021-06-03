import { Format } from '@cardstack/core/src/interfaces';
import Helper from '@ember/component/helper';
import { inject } from '@ember/service';
import ModalService from '../services/modal';

export default class OpenCardInModal extends Helper {
  @inject declare modal: ModalService;

  compute(params: string[], option: { format: Format }): () => void {
    let [cardURL] = params;
    let { format } = option;

    return () => {
      this.modal.openWithCard.perform(cardURL, format);
    };
  }
}
