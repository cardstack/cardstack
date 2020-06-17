import Controller from '@ember/controller';
import { action, set } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import resize from 'ember-animated/motions/resize';
import scale from 'ember-animated/motions/scale';
import move from 'ember-animated/motions/move';
import adjustCSS from 'ember-animated/motions/adjust-css';
import { parallel } from 'ember-animated';

export default class MediaRegistryItemVersionsController extends Controller {
  @tracked versions = this.model.versions;
  @tracked latest = this.versions[this.versions.length - 1];
  @tracked selected = this.latest.id;
  @tracked baseCard;
  @tracked comparisonCard;
  @tracked addedFields;
  @tracked addedValues;
  @tracked removedFields;
  @tracked removedValues;
  @tracked changedFields;
  @tracked changedCards;
  @tracked addedCards;
  @tracked removedCards;
  @tracked modifiedCard;
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
      set(v, 'position', `p${this.selected - v.id}`);
      if ((this.selected - v.id) < 0 ) {
        set(v, 'stackedFront', true);
      } else {
        set(v, 'stackedFront', false);
      }
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
  displayVersion(v) {
    if (this.baseCard && this.baseCard === v) {
      this.reset();
      this.selected = v;
    } else if (this.baseCard) {
      this.comparisonCard = v;
      this.compareCards();
    } else {
      this.selected = v;
      this.setPositions();
    }
  }

  @action
  setComparison(v) {
    if (this.baseCard && this.baseCard === v) {
      this.reset();
    } else if (this.baseCard) {
      this.comparisonCard = v;
      this.compareCards();
    } else {
      this.baseCard = v;
      this.selected = v;
    }
  }

  @action
  swap() {
    let comp = this.comparisonCard;
    this.comparisonCard = this.baseCard;
    this.baseCard = comp;
    this.compareCards();
  }

  @action
  compareCards() {
    this.addedFields = [];
    this.changedFields = [];
    this.removedFields = [];
    this.addedValues = [];
    this.removedValues = [];
    this.changedCards = [];
    this.addedCards = [];
    this.removedCards = [];
    this.modifiedCard = {};

    let baseCard = this.versions.filter(v => v.id === this.baseCard)[0];
    let comparisonCard = this.versions.filter(v => v.id === this.comparisonCard)[0];
    this.comparison(baseCard.card_model.fields, comparisonCard.card_model.fields);
  }

  @action
  comparison(baseCard, compCard) {
    let [ json1, json2 ] = [ baseCard, compCard ].map(data => JSON.stringify(data));

    if (json1 === json2) {
      return;
    }

    for (let field in compCard) {
      if (baseCard[field] === undefined) {
        this.removedFields.push(field);
      }

      for (let f in baseCard) {
        if (field === f) {
          if (baseCard[field] === null && compCard[field] !== null) {
            this.removedValues.push(field);
          }

          else if (compCard[field] === null && baseCard[field] !== null) {
            this.addedValues.push(field);
          }

          else if (JSON.stringify(compCard[field]) !== JSON.stringify(baseCard[field])) {
            if (typeof compCard[field] === "object" || typeof baseCard[field] === "object") {
              this.compareCollections(baseCard[field], compCard[field]);
            } else {
              this.changedFields.push({
                title: field,
                oldValue: compCard[field],
                value: baseCard[field]
              });
            }
          }
        }
      }
    }

    for (let field in baseCard) {
      if (compCard[field] === undefined) {
        this.addedFields.push(field);
      }
    }
  }

  @action
  compareCollections(baseCollection, compCollection) {
    if (typeof baseCollection !== 'object') {
      if (!compCollection.length) {
        return this.changedCards.push({ value: baseCollection, oldValue: compCollection });
      } else {
        for(const card of compCollection) {
          return this.changedCards.push({
            id: card.id,
            oldValue: card,
            value: baseCollection
          });
        }
      }
    }

    if (typeof compCollection !== 'object') {
      if (!baseCollection.length) {
        return this.changedCards.push({ value: baseCollection, oldValue: compCollection });
      } else {
        for(const card of baseCollection) {
          return this.changedCards.push({
            id: card.id,
            oldValue: compCollection,
            value: card
          });
        }
      }
    }

    if (baseCollection.length && compCollection.length) {
      if (baseCollection.length === compCollection.length) {
        baseCollection.forEach((card, i) => {
          if (JSON.stringify(card) === JSON.stringify(compCollection[i])) {
            return;
          }
          if (card.id === compCollection[i].id) {
            return this.changedCards.push({
              id: card.id,
              oldCard: compCollection[i],
              value: card
            });
          }
        });
      }

      for (let card of baseCollection) {
        let isPresent = compCollection.find(el => el.id === card.id) ? true : false;
        if (!isPresent) {
          this.addedCards.push(card);
        }
      }

      for (let card of compCollection) {
        let isPresent = baseCollection.find(el => el.id === card.id) ? true : false;
        if (!isPresent) {
          this.removedCards.push(card);
        }
      }
    } else {
      if (JSON.stringify(baseCollection) !== JSON.stringify(compCollection)) {
        this.modifiedCard = {
          value: baseCollection,
          oldValue: compCollection
        };
      } else {
        return;
      }
    }
  }

  @action
  * transition({ keptSprites }) {
    for (let sprite of keptSprites) {
      parallel(move(sprite), resize(sprite));
    }
  }

  @action
  * adjustOpacity({ keptSprites }) {
    for (let sprite of keptSprites) {
      parallel(move(sprite), scale(sprite), adjustCSS('opacity', sprite));
    }
  }

  @action
  * outerContent({ keptSprites }) {
    for (let sprite of keptSprites) {
      parallel(move(sprite), resize(sprite), adjustCSS('font-size', sprite));
    }
  }

  @action
  * innerContent({ keptSprites }) {
    for (let sprite of keptSprites) {
      parallel(move(sprite), scale(sprite));
    }
  }
}
