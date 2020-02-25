import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { task } from 'ember-concurrency';
import { cardDocument } from '@cardstack/core/card-document';

let nonce = 0;
export default class DropZone extends Component {
  @service data;
  @service draggable;
  @tracked dropZoneStatus = 'outside';
  @tracked nonce = nonce++;

  get isOverDropZone() {
    return this.dropZoneStatus === 'dragging';
  }

  @(task(function*() {
    if (!this.isOverDropZone) {
      this.args.toggleStubField(this.nonce);
    } else {
      let field = this.draggable.getField();
      let csAdoptsFrom;
      let csTitle;
      let csId;
      let csDescription;

      if (field.enclosingCard) {
        csAdoptsFrom = field.adoptsFromId;
        csTitle = field.name;
        csDescription = field.csTitle;
      } else {
        csAdoptsFrom = field;
        csTitle = 'New Field';
      }

      let dropShadowField = yield this.data.create(
        'stub-card',
        cardDocument()
          .withAttributes({ csId, csTitle, csDescription })
          .adoptingFrom(csAdoptsFrom).jsonapi
      );
      dropShadowField.dropZoneNonce = this.nonce;
      this.args.toggleStubField(this.nonce, this.args.position, dropShadowField);
    }
  }).restartable())
  createStubFieldCard;

  @action
  updateStatus(status, event) {
    let draggedField = this.draggable.getField();

    // either no dragged field, or mouse event triggered by a human
    if (!draggedField || (event && event.isTrusted && (event.type === 'mouseenter' || event.type === 'mouseleave'))) {
      return;
    }

    this.dropZoneStatus = status;

    if (this.args.toggleStubField) {
      this.createStubFieldCard.perform();
    }
  }

  @action dragOver(event) {
    event.preventDefault();
  }
}
