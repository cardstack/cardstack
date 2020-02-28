import BaseEditor from './base-editor';
import { task } from 'ember-concurrency';

export default class URLViewer extends BaseEditor {
  @(task(function*() {
    let url = yield this.args.card.enclosingCard.value(this.args.card.name);
    this.fieldValue = url ? url.toString() : null;
  }).drop())
  load;
}
