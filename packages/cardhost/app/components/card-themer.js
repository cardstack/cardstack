import CardManipulator from './card-manipulator';
import { action } from '@ember/object';
import { task } from 'ember-concurrency';
import { inject as service } from '@ember/service';
import { isolatedCssFile } from '../utils/scaffolding';
import { tracked } from '@glimmer/tracking';

export default class CardThemer extends CardManipulator {
  @service cssModeToggle;
  @tracked isCardReady = false;
  @tracked isolatedCss;
  loadingCss = `
    .card-renderer-isolated--card-container {
      background-color: white;
      color: white;
    }
  `;

  @(task(function*(css) {
    yield this.load.last.finally();

    this.isolatedCss = css;

    let card = this.args.card;
    let { csFiles = {}, csFeatures = {} } = card;

    let doc = card.document;
    csFeatures['isolated-css'] = isolatedCssFile;
    csFiles[isolatedCssFile] = css;
    doc.withAttributes({ csFeatures, csFiles });

    yield this.patchCard.perform(doc);
  }).restartable())
  updateCardCss;

  @(task(function*() {
    yield this.load.last.finally();
    this.isCardReady = true;
  }).drop())
  waitForCss;

  @action
  updateCss(css) {
    this.updateCardCss.perform(css);
  }
}
