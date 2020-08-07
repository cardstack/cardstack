import Controller from '@ember/controller';
import { action, set } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class MediaRegistryDiscrepanciesDiscrepancyController extends Controller {
  @tracked count;
  @tracked displayId;
  @tracked removed = [];

  @action
  adjustCount() {
    if (this.model.count) {
      this.count = this.model.count;
    } else {
      this.count = 0;
      set(this.model, 'count', this.count);
    }

    if (this.model.displayId) {
      this.displayId = this.model.displayId;
    } else {
      this.displayId = [];
      set(this.model, 'displayId', []);
    }
  }

  @action
  compareFields(field, compField) {
    // assumption: cards have the same fields even if values might be null

    let [ json1, json2 ] = [ field, compField ].map(data => JSON.stringify(data));

    if (json1 === json2) {
      return;
    }

    if (compField.type === 'collection' || field.type === 'collection') {
      this.collectionComparison(field, compField);
      return;
    }

    if (!field.value && compField.value) {
      set(compField, 'status', 'added');
      return;
    }

    if (field.value && !compField.value) {
      set(compField, 'status', 'removed');
      return;
    } // removed

    set(compField, 'status', 'modified');
    return;
  }

  @action
  collectionComparison(field, compField) {
    if (!field.value && !compField.value) {
      return;
    }

    if (!field.value) {
      for (let card of compField.value) {
        set(card, 'status', 'added');
      }
      return;
    }

    if (!compField.value) {
      set (compField, 'compCollection', []);
      set (compField, 'type', field.type);
      set (compField, 'component', field.component);

      for (let card of field.value) {
        set(card, 'status', 'removed');
        set(compField, 'compCollection', [ ...compField.compCollection, card ]);
      }
      return;
    }

    if (field.value.length && compField.value.length) {
      set (compField, 'compCollection', [ ...compField.value ]);

      for (let card of compField.value) {
        let eqCard = field.value.find(el => el.id === card.id);
        if (eqCard) {
          this.compareFields(eqCard, card);
        } else {
          set(card, 'status', 'added');
        }
      }

      for (let card of field.value) {
        let eqCard = compField.value.find(el => el.id === card.id);
        if (!eqCard) {
          set(card, 'status', 'removed');
          set(compField, 'compCollection', [ ...compField.compCollection, card ]);
        }
      }
    }
  }

  @action
  reconciliateField(field, compField) {
    set(field, 'new', {});
    set(field.new, 'title', compField.title);
    set(field.new, 'value', compField.value);

    if (compField.type) {
      set(field.new, 'type', compField.type);
    }

    if (compField.component) {
      set(field.new, 'component', compField.component);
    }

    this.count++;
    set(this.model, 'count', this.count);
  }

  @action
  revertField(field) {
    set(field, 'new', false);
    this.count--;
    set(this.model, 'count', this.count);
  }

  @action selectChange(val, title, component) {
    let collection = this.model.baseCard.isolatedFields.find(el => el.title === title);

    if (collection && collection.value) {
      let item = collection.value.find(el => el.id === val.id);

      if (item) {
        set(item, 'new', val);
      } else {
        set(collection, 'value', [ ...collection.value, val ]);
      }
    } else {
      set(collection, 'value', [ val ]);
      set(collection, 'type', 'collection');
      set(collection, 'component', component);
    }

    this.displayId = [ ...this.displayId, val.id];
    set(this.model, 'displayId', this.displayId);
    // set(val, 'new', true);
    this.count++;
    set(this.model, 'count', this.count);
  }

  @action revertChange(val, title) {
    let collection = this.model.baseCard.isolatedFields.find(el => el.title === title);
    this.displayId = this.displayId.filter(el => el !== val.id);
    set(this.model, 'displayId', this.displayId);

    if (collection && collection.value) {
      this.removed.push(val);
      let newColl = collection.value.filter(el => !this.removed.includes(el));
      set(collection, 'value', newColl);
      this.removed = [];
    } else {
      set(collection, 'value', null);
      set(collection, 'type', null);
      set(collection, 'component', null);
    }

    if (this.count > 0) {
      this.count--;
      set(this.model, 'count', this.count);
    }
  }
}
