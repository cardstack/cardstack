import { task } from 'ember-concurrency';
import { tracked } from '@glimmer/tracking';
import BaseIsolatedLayoutComponent from '../base-isolated-layout';

export default class PhotoCardIsolatedComponent extends BaseIsolatedLayoutComponent {
  @tracked bylineName;
  @tracked bylineImageURL;

  constructor(...args) {
    super(...args);

    this.loadBylineCard.perform();
  }

  @task(function*() {
    let byline = yield this.args.card.value('photo-byline');
    if (!byline) {
      return;
    }
    this.bylineName = yield byline.value('name');
    this.bylineImageURL = yield byline.value('image');
  })
  loadBylineCard;

  notByline(fieldCard) {
    return fieldCard.name !== 'photo-byline';
  }

  get bylineIsEditable() {
    return this.args.mode === 'edit' || this.args.model === 'schema';
  }
}
