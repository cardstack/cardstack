import BaseEditor from '../base-editor';
import { task } from 'ember-concurrency';
import moment from 'moment';

export default class DateTimeViewer extends BaseEditor {
  @(task(function*() {
    let isoDate = yield this.args.card.enclosingCard.value(this.args.card.name);
    let localDate = isoDate ? moment(isoDate).format('YYYY-MM-DDTHH:mm') : null;
    this.fieldValue = localDate;
  }).drop())
  load;
}
