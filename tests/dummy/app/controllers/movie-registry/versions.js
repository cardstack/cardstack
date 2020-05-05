import Controller from '@ember/controller';
import { action, set } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import resize from 'ember-animated/motions/resize';
import scale from 'ember-animated/motions/scale';
import move from 'ember-animated/motions/move';
import adjustCSS from 'ember-animated/motions/adjust-css';
import { easeIn } from 'ember-animated/easings/cosine';
import { parallel } from 'ember-animated';
import compensateForScale from 'ember-animated/motions/compensate-for-scale';


export default class MovieRegistryVersionsController extends Controller {
  @tracked versions = this.model.versions;
  @tracked latest = this.versions[this.versions.length - 1];
  @tracked selected = this.latest.id;
  @tracked baseCard;
  @tracked comparisonCard;
  @tracked addedFields;
  @tracked changedFields;
  @tracked removedFields;
  @tracked view = 'show-all';

  get isCompView() {
    return this.comparisonCard && this.baseCard;
  }

  get baseCardContent() {
    return this.versions.filter(item => item.id === this.baseCard)[0];
  }

  get compCardContent() {
    return this.versions.filter(item => item.id === this.comparisonCard)[0];
  }

  @action
  setPositions() {
    for (let v of this.versions) {
      set(v, 'position', `p${this.selected - v.id}`)
    }
  }

  @action
  reset() {
    this.baseCard = null;
    this.comparisonCard = null;
    this.addedFields = [];
    this.changedFields = [];
    this.removedFields = [];
  }

  @action
  displayVersion(id) {
    if (this.baseCard && this.baseCard === id) {
      this.reset();
      this.selected = id;
    } else if (this.baseCard) {
      this.comparisonCard = id;
      this.compareCards();
    } else {
      this.selected = id;
      this.setPositions();
    }
  }

  @action
  setComparison(id) {
    if (this.baseCard && this.baseCard === id) {
      this.reset();
    } else if (this.baseCard) {
      this.comparisonCard = id;
      this.compareCards();
    } else {
      this.baseCard = id;
      this.selected = id;
    }
  }

  @action
  swap() {
    let comp = this.comparisonCard;
    this.comparisonCard = this.baseCard;
    this.baseCard = comp;
  }

  @action
  compareCards() {
    this.addedFields = [];
    this.changedFields = [];
    this.removedFields = [];

    let baseCard = this.versions.filter(v => v.id === this.baseCard)[0];
    let comparisonCard = this.versions.filter(v => v.id === this.comparisonCard)[0];

    let card1, card2;
    if (baseCard.id < comparisonCard.id) {
      card1 = baseCard.savedData;
      card2 = comparisonCard.savedData;
    } else {
      card1 = comparisonCard.savedData;
      card2 = baseCard.savedData;
    }

    let [ json1, json2 ] = [ card1, card2 ].map(data => JSON.stringify(data));

    if (json1 === json2) {
      return;
    }

    for (let field in card1) {
      if (card2[field] === undefined) {
        this.removedFields.push(field);
      }

      for (let f in card2) {
        if (field === f) {
          if (card1[field].value !== card2[f].value) {
            this.changedFields.push(field);
          }
        }
      }
    }

    for (let field in card2) {
      if (card1[field] === undefined) {
        this.addedFields.push(field);
      }
    }
  }

  @action
  * transition({ keptSprites }) {
    for (let sprite of keptSprites) {
      parallel(move(sprite, { easing: easeIn }), resize(sprite, { easing: easeIn }));
    }
  }

  @action
  * adjustOpacity({ keptSprites }) {
    for (let sprite of keptSprites) {
      parallel(move(sprite, { easing: easeIn }), scale(sprite, { easing: easeIn }), adjustCSS('opacity', sprite));
    }
  }

  @action
  * adjustContent({ keptSprites }) {
    for (let sprite of keptSprites) {
      parallel(move(sprite, { easing: easeIn }), scale(sprite, { easing: easeIn }), compensateForScale(sprite, { easing: easeIn }));
    }
  }
}
