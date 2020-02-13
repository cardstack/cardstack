import { task } from 'ember-concurrency';
import CardManipulator from './card-manipulator';

export default class CardViewer extends CardManipulator {
  resizeable = true;

  @(task(function*() {
    this.isolatedCss = yield this.args.card.loadFeature('isolated-css');
  }).drop())
  loadCss;
}
