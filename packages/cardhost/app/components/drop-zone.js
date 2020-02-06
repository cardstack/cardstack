import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { task } from 'ember-concurrency';
import { cardDocument } from '@cardstack/core/card-document';
import { getUserRealm } from '../utils/scaffolding';

export default class DropZone extends Component {
  @service data;
  @tracked dropZoneStatus = 'outside';

  get isOverDropZone() {
    return this.dropZoneStatus === 'dragging';
  }

  @(task(function*() {
    let field = yield this.data.create(
      getUserRealm(),
      // TODO we should really have this field adopt from the field being
      // dragged too so that we can show the card type in the stub field
      cardDocument().withAttributes({
        csRealm: 'stub-card',
        csTitle: 'New Field',
      }).jsonapi
    );
    this.args.toggleStubField(field, this.args.position, this.isOverDropZone);
  }).drop())
  createStubFieldCard;

  @action
  updateStatus(status) {
    this.dropZoneStatus = status;

    if (this.args.toggleStubField) {
      this.createStubFieldCard.perform();
    }
  }

  @action dragOver(event) {
    event.preventDefault();
  }
}
