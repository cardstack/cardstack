import Component from '@glimmer/component';
import { action, set } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { typeOf } from '@ember/utils';

export default class ComparisonComponent extends Component {
  @tracked model = this.args.model;
  @tracked count;
  @tracked displayId; // TODO: clean up this field
  @tracked removed = [];
  @tracked mode = 'comparison';
  @tracked lastSelection;
  @tracked nestedView = this.args.nestedView;
  @tracked nestedField = [];
  @tracked nestedCompField = [];
  @tracked fieldsNotRendered = this.args.fieldsNotRendered;
  omittedFields = this.args.omittedFields;
  cardTypes = this.args.cardTypes;

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

    this.mode = 'comparison';
    this.lastSelection = null;
    this.nestedView = false;
    this.nestedField = [];
    this.nestedCompField = [];
  }

  @action
  getNestedFields() {
    this.mode = 'comparison';
    this.nestedView = true;
    this.nestedField = [];
    this.nestedCompField = [];

    let topLevelCard = this.model.topLevelCard;

    if (topLevelCard.count) {
      this.count = topLevelCard.count;
    } else {
      this.count = 0;
      set(topLevelCard, 'count', this.count);
    }

    if (topLevelCard.displayId) {
      this.displayId = topLevelCard.displayId;
    } else {
      this.displayId = [];
      set(topLevelCard, 'displayId', []);
    }

    if (this.model.nestedField && this.model.nestedField.fields && this.model.nestedField.fields.length) {
      for (let f of this.model.nestedField.fields) {
        this.model.nestedField[f.title] = f.value;
      }
    }

    if (this.model.nestedCompField && this.model.nestedCompField.fields && this.model.nestedCompField.fields.length) {
      for (let f of this.model.nestedCompField.fields) {
        this.model.nestedCompField[f.title] = f.value;
      }
    }

    if (this.model.nestedCompField && this.model.nestedCompField.type === 'territory') {
      this.fieldsNotRendered = [...this.fieldsNotRendered, 'title', 'value'];
    }

    this.nestedField = this.getFieldArray(this.model.nestedField, this.model.nestedCompField);
    this.nestedCompField = this.getFieldArray(this.model.nestedCompField);
  }

  @action getFieldArray(field, allFields) {
    let array = [];
    let fieldData = allFields ? allFields : field;

    for (let f in fieldData) {
      if (!this.fieldsNotRendered.includes(f)) {

        if (fieldData[f] && typeof fieldData[f] === 'object') {
          if (typeOf(fieldData[f]) === 'array' || (fieldData[f].value && fieldData[f].value.length) || fieldData[f].type === 'collection') {
            array = [...array, {
              title: f,
              type: 'collection',
              component: fieldData[f].component ? fieldData[f].component : null,
              value: field && field[f] ? field[f].value || field[f] : null
            }];
          } else {
            array = [...array, {
              title: f,
              type: 'card',
              value: field ? field[f] : null,
              component: field && field[f] && field[f].type === 'participant' ? 'cards/composer' : null // TODO
            }];
          }
        } else {
          array = [...array, {
            title: f,
            value: field ? field[f] : null
          }];
        }
      }
    }
    return array;
  }

  @action
  selectView(val) {
    this.mode = val;
    this.lastSelection = val;
  }

  @action
  toggleView() {
    if (this.mode === 'comparison') {
      if (this.lastSelection) {
        this.mode = this.lastSelection;
      } else {
        this.mode = 'keep-current';
        this.lastSelection = 'keep-current';
      }
    } else {
      this.mode = 'comparison';
    }
  }

  @action
  compareFields(field, compField) {
    // assumption: cards have the same fields even if values might be null

    let [ json1, json2 ] = [ field, compField ].map(data => JSON.stringify(data));

    if (json1 === json2 || (!field.value && !compField.value && !field.id && !compField.id)) {
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

    if (!this.omittedFields.includes(field.title)) {
      this.diffCount(field, compField);
    }

    return;
  }

  @action
  diffCount(field, compField) {
    let count = 0;
    count += this.diffCounter(count, field, compField);
    if (count > 0) {
      set(compField, 'modifiedCount', count);
    }
  }

  @action
  diffCounter(count, field, compField) {
    for (let f in compField) {
      if (!this.fieldsNotRendered.includes(f)) {
        if (typeof compField[f] === 'object') {
          if (f === 'publisher' && compField[f].value && !field[f].value) {
            count++; // count this field as only 1
          } else if (f === 'publisher') {
            count; // skipping this field
          } else {
            count += this.diffCounter(count, field[f], compField[f]);
          }
        }
        else if ((!field && compField) || field[f] !== compField[f]) {
          count++;
        }
      }
    }
    return count;
  }

  @action
  collectionComparison(field, compField) {
    // clear previously set card status
    if (compField.value && compField.value.length) {
      compField.value.forEach(card => set(card, 'status', null));
    }
    if (field.value && field.value.length) {
      field.value.forEach(card => set(card, 'status', null));
    }

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
    let tempField = Object.assign({}, compField);
    set(field, 'tempField', tempField);

    if (!this.model.grandParentCard && this.model.parentCard) {
      if (this.model.parentCard.nestedField) {
        let tempItem;

        if (this.model.nestedField.tempItem) {
          tempItem = this.model.nestedField.tempItem;
        } else {
          tempItem = Object.assign({}, this.model.nestedField);
        }

        set(tempItem, field.title, compField.value);
        set(this.model.nestedField, 'tempItem', tempItem);

        let item = this.model.parentCard.nestedField;

        let newCount = 1;
        if (item.modifiedCount) {
          newCount = item.modifiedCount + newCount;
        }
        set(item, 'modifiedCount', newCount);

        this.count++;
        let model = this.model.topLevelCard;
        set(model, 'count', this.count);

        this.selectChange(this.model.parentCard.nestedField, this.model.parentCard.cardType);
        // set(this.model.parentCard.nestedField[this.model.cardType], field.title, compField.value);
      }
    }

    else if (!this.model.parentCard && this.model.topLevelCard) {
      let model = this.model.topLevelCard;

      if (!this.model.nestedField) {
        let newField = {
          id: this.model.nestedCompField.id,
          type: this.model.nestedCompField.type
        }
        set(this.model, 'nestedField', newField);
        let baseField = this.model.topLevelCard.baseCard.isolatedFields.find(el => el.title === this.model.cardType);
        let compField = this.model.topLevelCard.compCard.isolatedFields.find(el => el.title === this.model.cardType);

        if (compField.type && compField.type === 'collection') {
          let value = baseField.value || baseField.tempCollection;

          if (value) {
            set(baseField, 'tempCollection', [ ...value, this.model.nestedField ]);
          } else {
            baseField.type = compField.type;
            baseField.component = compField.component;
            baseField.tempCollection = [ this.model.nestedField ];
          }

          this.model.nestedField.new = true;
          this.model.nestedField.status = 'added';

          this.displayId = [ ...this.displayId, this.model.cardId];
          set(model, 'displayId', this.displayId);

        } else if (compField.type && compField.type === 'card') {
          let compCard = Object.assign({}, compField);
          let newCard = {};

          for (let f in compCard) {
            newCard[f] = compCard[f];
          }

          newCard.value = this.model.nestedField;

          set(baseField, 'tempField', newCard);
        }
      }

      set(this.model.nestedField, field.title, compField.value);

      if (compField.modifiedCount) {
        this.count += compField.modifiedCount;
      } else {
        this.count++;
      }

      set(model, 'count', this.count);
    }

    if (!this.nestedView) {
      this.count++;
      set(this.model, 'count', this.count);
    }
  }

  @action
  revertField(field) {
    set(field, 'tempField', null);

    if (this.count > 0) {
      this.count--;
      set(this.model, 'count', this.count);
    }
  }

  @action selectChange(val, title, component) {
    let model = this.model.topLevelCard || this.model;
    let collection = model.baseCard.isolatedFields.find(el => el.title === title);

    // assumption: cards have the same fields even if values might be null
    if (!collection) { return; }

    if (collection.tempCollection || collection.value) {
      let tempVal = Object.assign({}, val);
      let tempCollection = Object.assign([], collection.tempCollection || collection.value);
      let item = tempCollection.find(el => el.id === val.id);

      if (item) {
        tempCollection.filter((el, i) => {
          if (el.id === tempVal.id) {
            tempCollection[i] = tempVal;
            tempCollection[i].new = true;
            tempCollection[i].status = 'modified';
          }
        });
      } else {
        tempVal.new = true;
        tempCollection = [ ...tempCollection, tempVal ];
      }
      set(collection, 'tempCollection', tempCollection);
    } else {
      let tempVal = Object.assign({}, val);
      tempVal.new = true;
      set(collection, 'type', 'collection');
      set(collection, 'component', component);
      set(collection, 'tempCollection', [ tempVal ]);
    }

    this.displayId = [ ...this.displayId, val.id];
    set(model, 'displayId', this.displayId);

    if (!this.nestedView) {
      if (val.modifiedCount) {
        this.count += val.modifiedCount;
      } else {
        this.count++;
      }

      set(model, 'count', this.count);
    }
  }

  @action revertChange(val, title) {
    let collection = this.model.baseCard.isolatedFields.find(el => el.title === title);
    this.displayId = this.displayId.filter(el => el !== val.id);
    set(this.model, 'displayId', this.displayId);

    if (collection.tempCollection && collection.value) {
      let tempCollection = Object.assign([], collection.tempCollection);
      let tempVal = Object.assign({}, val);
      let item = collection.value.find(el => el.id === tempVal.id);
      if (item) {
        tempCollection.filter((el, i) => {
          if (el.id === tempVal.id) {
            tempCollection[i] = item;
          }
        });
        set(collection, 'tempCollection', tempCollection);
      } else {
        this.removed.push(val.id);
        let filteredColl = collection.tempCollection.filter(el => !this.removed.includes(el.id));
        set(collection, 'tempCollection', filteredColl);
        this.removed = [];
      }
    }

    else if (collection.tempCollection) {
      this.removed.push(val.id);
      let filteredColl = collection.tempCollection.filter(el => !this.removed.includes(el.id));
      set(collection, 'tempCollection', filteredColl);
      this.removed = [];
    }
    else {
      return;
    }

    if (val.modifiedCount) {
      if (val.modifiedCount > this.count) {
        this.count = 0;
      } else {
        this.count -= val.modifiedCount;
      }
    } else {
      this.count--;
    }
    set(this.model, 'count', this.count);
  }
}
