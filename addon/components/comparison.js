import Component from '@glimmer/component';
import { action, set } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class ComparisonComponent extends Component {
  @tracked model = this.args.model;
  @tracked baseFieldGroup = [];
  @tracked compFieldGroup = [];
  @tracked count;
  @tracked removed = [];
  @tracked mode = 'keep-current';
  @tracked nestedView = this.args.nestedView;
  fieldsNotRendered = this.args.fieldsNotRendered;
  omittedFields = this.args.omittedFields;

  @action
  adjustCount() {
    this.model = Object.assign({}, this.args.model);
    this.mode = 'keep-current';
    this.nestedView = false;
    this.baseFieldGroup = this.model.baseCard.isolatedFields;
    this.compFieldGroup = this.model.compCard.isolatedFields;

    if (this.model.count) {
      this.count = this.model.count;
    } else {
      this.count = 0;
      set(this.model, 'count', this.count);
    }
  }

  @action
  getNestedFields() {
    this.mode = 'comparison';
    this.nestedView = true;

    if (this.model.topLevelCard.count) {
      this.count = this.model.topLevelCard.count;
    } else {
      this.count = 0;
      set(this.model.topLevelCard, 'count', this.count);
    }

    // This could be useful when expanding default cards and displaying card fields
    // if (this.model.nestedField && this.model.nestedField.fields && this.model.nestedField.fields.length) {
    //   for (let f of this.model.nestedField.fields) {
    //     this.model.nestedField[f.title] = f.value;
    //   }
    // }

    // if (this.model.nestedCompField && this.model.nestedCompField.fields && this.model.nestedCompField.fields.length) {
    //   for (let f of this.model.nestedCompField.fields) {
    //     this.model.nestedCompField[f.title] = f.value;
    //   }
    // }

    this.baseFieldGroup = this.getFieldArray(this.model.nestedField, this.model.nestedCompField);
    this.compFieldGroup = this.getFieldArray(this.model.nestedCompField);

    // if (this.baseFieldGroup.length && this.compFieldGroup.length) {
    //   this.compareFields()
    // }
  }

  @action getFieldArray(field, allFields) {
    let array = [];
    let fieldData = allFields ? allFields : field;

    for (let f in fieldData) {
      if (!this.fieldsNotRendered.includes(f)) {
        if (fieldData[f] && typeof fieldData[f] === 'object') {
          let cardComponent;

          if (fieldData[f].type) {
            if (fieldData[f].type === 'participant') {
              cardComponent = 'cards/composer';
            } else if (fieldData[f].type === 'territory') {
              cardComponent = 'cards/territory';
            }
          }

          // left-side card only
          // status + modified count NOT set during compareFields fn
          if (allFields && !this.model.parentCard) {
            let tempField,
                modifiedCount,
                status;

            if (field.modifiedCount && f !== 'publisher') {
              modifiedCount = field.modifiedCount;
            }

            if (field.tempField) {
              if (status) {
                tempField = {
                  title: f,
                  type: 'card',
                  component: cardComponent || null,
                  value: field.tempField[f]
                };
              }

              if (field.tempField.status && f !== 'publisher') {
                status = field.tempField.status;
              }
            }

            array = [...array, {
              title: f,
              type: 'card',
              component: cardComponent || null,
              value: field[f] || null,
              tempField,
              expandable: cardComponent === 'cards/composer' ? true : false,
              status,
              modifiedCount
            }];
          }

          // right-side card
          // status + modified count for this one will be set during compareFields fn
          else {
            array = [...array, {
              title: f,
              type: 'card',
              component: cardComponent || null,
              value: field[f] || null,
              expandable: cardComponent === 'cards/composer' ? true : false
            }];
          }
        } else {
          // left-side field
          // if (allFields && !this.model.parentCard) {
          //   let tempField,
          //       modifiedCount,
          //       status;

          //   if (field.modifiedCount) {
          //     modifiedCount = field.modifiedCount;
          //   }

          //   if (field.tempField) {
          //     if (status) {
          //       tempField = {
          //         title: f,
          //         value: field.tempField[f]
          //       };
          //     }

          //     if (field.tempField.status) {
          //       status = field.tempField.status;
          //     }
          //   }

          //   array = [...array, {
          //     title: f,
          //     value: field[f] || null,
          //     tempField,
          //     status,
          //     modifiedCount
          //   }];
          // }

          // else {
            array = [...array, {
              title: f,
              value: field[f] || null
            }];
          // }

        }
      }
    }
    return array;
  }

  @action
  selectView(val) {
    this.mode = val;
  }

  @action
  compareFields(field, compField) {
    this.setCompFieldDiffCount(field, compField);

    if (!field.type && compField.type) {
      set(compField, 'status', 'added');

      return;
    }

    let [ json1, json2 ] = [ field, compField ].map(data => {
      try {
        return JSON.stringify(data);
      } catch(err) {
        return;
      }
    });

    if (json1 === json2 || (!field.value && !compField.value && !field.id && !compField.id)) {
      set(compField, 'modifiedCount', 0);
      set(compField, 'status', null);
      return;
    }

    if (!field.type && field.value === compField.value) {
      set(compField, 'modifiedCount', 0);
      set(compField, 'status', null);
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
    if (compField.modifiedCount === 0) {
      set(compField, 'status', null);
    }

    return;
  }

  @action
  setCompFieldDiffCount(field, compField) {
    if (compField.expandable) {
      let numChanges;
      // if (!this.nestedView && field.tempField) {
      //   numChanges = this.diffCounter(0, field.tempField, compField);
      // } else {
        numChanges = this.diffCounter(0, field, compField);
      // }

      set(compField, 'modifiedCount', numChanges);
      if (numChanges === 0) {
        set(compField, 'status', null);
      }
    }
  }

  @action
  diffCounter(count, field, compField) {
    for (let f in compField) {
      if (!this.fieldsNotRendered.includes(f)) {
        if (compField[f] && compField[f].expandable) {
          count += this.diffCounter(count, field[f], compField[f]);
        }
        else if (!field && !compField || !field && !compField[f]) {
          count;
        }
        else if (f === 'publisher') {
          if ((!field && compField) || (!field[f] && compField[f])) {
            count++;
          } else {
            count;
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
  reconciliateField(field, compField) {
    let tempField = Object.assign({}, compField);
    set(field, 'tempField', tempField);

    if (this.nestedView && this.model.parentCard) {
      // debugger;
      // let topField = this.model.topLevelCard.baseCard.isolatedFields.find(el => el.title === this.model.parentCard.cardType);
      // let topCard = topField.value.find(el => el.id === this.model.parentCard.cardId);

      // let topCompField = this.model.topLevelCard.compCard.isolatedFields.find(el => el.title === this.model.parentCard.cardType);
      // let topCompCard = topCompField.value.find(el => el.id === this.model.parentCard.cardId);

      // let tempField = Object.assign({}, topCard[this.model.cardType]);

      // tempField[field.title] = compField.value;
      // tempField.status = topCompCard.status;
      // debugger;

      // set(topCard[this.model.cardType], 'tempField', tempField);

      // let modCount = topCard.modifiedCount ? topCard.modifiedCount : 0;
      // modCount++;
      // set(topCard[this.model.cardType], 'modifiedCount', modCount);

      let newTempField;
      if (this.model.parentCard.nestedField.tempField) {
        newTempField = Object.assign({}, this.model.parentCard.nestedField.tempField);
      } else {
        newTempField = Object.assign({}, this.model.parentCard.nestedField);
      }

      if (!newTempField[this.model.cardType]) {
        newTempField[this.model.cardType] = {};
      }

      set(newTempField[this.model.cardType], field.title, compField.value);
      newTempField.changedFieldTitle = field.title;

      if (this.model.parentCard.nestedField.id && !this.model.parentCard.nestedField.type) {
        newTempField.status = 'added';
      } else {
        newTempField.status = 'modified';
      }

      set(this.model.parentCard.nestedField, 'tempField', newTempField);

      let modiCount = this.model.parentCard.nestedField.modifiedCount || 0;
      modiCount++;

      set(this.model.parentCard.nestedField, 'modifiedCount', modiCount);

      this.count = this.model.topLevelCard.count;
      this.count++;
      set(this.model.topLevelCard, 'count', this.count);
    }

    else if (!this.model.parentCard && this.model.topLevelCard) {
      let topField = this.model.topLevelCard.baseCard.isolatedFields.find(el => el.title === this.model.cardType);
      let topCard = topField.value.find(el => el.id === this.model.cardId);

      let topCompField = this.model.topLevelCard.compCard.isolatedFields.find(el => el.title === this.model.cardType);
      let topCompCard = topCompField.value.find(el => el.id === this.model.cardId);

      let tempField = Object.assign({}, topCard);
      tempField[field.title] = compField.value;
      tempField.status = topCompCard.status;

      set(topCard, field.title, compField.value);
      set(topCard, 'status', topCompCard.status);

      set(topCard, 'tempField', tempField);

      let modCount = topCard.modifiedCount ? topCard.modifiedCount : 0;
      if (compField.expandable) {
        let numDiff = this.diffCounter(0, field, compField);
        if (numDiff > 0) {
          set(field, 'modifiedCount', numDiff);
        }
        modCount += numDiff;
      } else {
        modCount++;
      }
      set(topCard, 'modifiedCount', modCount);
      this.count = modCount;
      set(this.model.topLevelCard, 'count', this.count);
    }

    else {
      if (compField.expandable) {
        if (!this.count) {
          this.count = compField.modifiedCount;
        } else {
          let numDiff = this.diffCounter(0, field, compField);
          if (numDiff > 0) {
            set(field, 'modifiedCount', numDiff);
          }
          this.count += numDiff;
        }
      } else {
        this.count++;
      }
      set(this.model, 'count', this.count);
    }
  }

  @action
  revertField(field, compField) {
    set(field, 'tempField', null);

    if (this.nestedView) {
      this.count = this.model.topLevelCard.count;
      if (this.count > 0) {
        this.count--;
        set(this.model.topLevelCard, 'count', this.count);
      }
    } else {
      if (field.expandable || compField.expandable) {
        let numDiff = this.diffCounter(0, field, compField);
        let modCount = field.modifiedCount;

        if (modCount && modCount >= numDiff) {
          set(field, 'modifiedCount', modCount - numDiff);
          this.count = this.count - modCount;
        }
        else if (!modCount) {
          set(field, 'modifiedCount', 0);
          this.count = 0;
        }
        else {
          set(field, 'modifiedCount', 0);
          this.count = this.count - numDiff;
        }
      } else {
        this.count--;
      }

      if (this.count > -1) {
        set(this.model, 'count', this.count);
      } else {
        this.count = 0;
        set(this.model, 'count', 0);
      }
    }
  }
}
