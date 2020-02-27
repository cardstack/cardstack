import { task } from 'ember-concurrency';
import moment from 'moment';
import DateTimeViewer from './datetime-viewer';

export default class DateTimeFieldEditLayout extends DateTimeViewer {
  @(task(function*(value) {
    let isoDate = value ? new Date(value).toISOString() : null;
    let localDate = isoDate ? moment(isoDate).format('YYYY-MM-DDTHH:mm') : null;
    this.fieldValue = localDate;
    yield this.args.setCardValue.perform(this.args.card.name, isoDate);
  }).restartable())
  updateFieldValue;
}
