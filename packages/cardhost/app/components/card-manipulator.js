import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { dasherize } from '@ember/string';
import { startCase } from 'lodash';
import { task } from 'ember-concurrency';
import ENV from '@cardstack/cardhost/config/environment';
import { fieldTypeMappings } from '../utils/mappings';
import drag from '../motions/drag';
import move from 'ember-animated/motions/move';
import scaleBy from '../motions/scale';
import { parallel } from 'ember-animated';
import { fadeOut } from 'ember-animated/motions/opacity';

const { environment } = ENV;

export default class CardManipulator extends Component {
  fieldTypeMappings = fieldTypeMappings;

  @service data;
  @service router;
  @service cardstackSession;
  @service cssModeToggle;
  @service draggable;

  @tracked statusMsg;
  @tracked card;
  @tracked selectedField;
  @tracked isDragging;
  @tracked cardId;
  @tracked cardSelected = true;

  constructor(...args) {
    super(...args);

    this.card = this.args.card;
  }

  get cardJson() {
    if (!this.card) {
      return null;
    }
    return JSON.stringify(this.card.json, null, 2);
  }

  get isDirtyStr() {
    return this.card.isDirty.toString();
  }

  get didUpdate() {
    if (this.args.card && !this.args.card.isNew && (!this.card || this.args.card.id !== this.card.id)) {
      this.card = this.args.card;
    }
    return null;
  }

  @action
  updateCard(element, [card]) {
    if (!card.isNew) {
      this.card = card;
    }
  }

  @task(function*() {
    this.statusMsg = null;
    try {
      yield this.card.delete();
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
      this.statusMsg = `card ${this.card.name} was NOT successfully deleted: ${e.message}`;
      return;
    }
    this.router.transitionTo('index');
  })
  deleteCard;

  @action
  removeField(fieldNonce) {
    if (fieldNonce == null || !this.card) {
      return;
    }

    // using field nonce in order to be resiliant to the scenario where the user deletes the name of the field too
    let field = this.card.getFieldByNonce(fieldNonce);

    if (field === this.selectedField) {
      this.cardSelected = true;
    }

    field.remove();
  }

  @action
  addField(displayType, name, isEmbedded, value, position) {
    let type = displayType ? fieldTypeMappings[displayType] : null;
    if (!this.card || !type || !name) {
      return;
    }

    let field = this.card.addField({
      type,
      position,
      name: dasherize(name).toLowerCase(),
      neededWhenEmbedded: isEmbedded,
    });

    if (value != null) {
      field.setValue(value);
    }
  }

  @action
  setPosition(fieldName, position) {
    if (!fieldName || !this.card || position == null) {
      return;
    }

    let card = this.card;
    card.moveField(card.getField(fieldName), position);
  }

  @action
  setNeededWhenEmbedded(fieldName, neededWhenEmbedded, evt) {
    // this prevents 2-way data binding from trying to alter the Field
    // instance's neededWhenEmbedded value, which is bound to the input
    // that fired this action. Our data service API is very unforgiving when
    // you try to change the Field's state outside of the official API
    // (which is what ember is trying to do). Ember gets mad when it sees
    // that it can't alter the Field's state via the 2-way binding and
    // makes lots of noise. interestingly, this issue only seems to happen
    // when running tests. This work around has yucky visual side effects,
    // so only performing in the test env. A better solution would be to use/make
    // a one-way input control for setting the field.neededWhenEmbedded value.
    // The <Input> component is unfortunately, is not a one-way input helper
    if (environment === 'test') {
      evt.preventDefault();
    }

    this.card.getField(fieldName).setNeededWhenEmbedded(neededWhenEmbedded);
  }

  @action
  setFieldValue(fieldName, value) {
    if (!fieldName || !this.card) {
      return;
    }
    this.card.getField(fieldName).setValue(value);
  }

  @action
  setFieldName(oldFieldName, newFieldName) {
    this.card.getField(oldFieldName).setName(newFieldName);
    this.card.getField(newFieldName).setLabel(startCase(newFieldName));
  }

  @action
  setFieldLabel(fieldName, label) {
    this.card.getField(fieldName).setLabel(label);
  }

  @action
  setFieldInstructions(fieldName, instructions) {
    this.card.getField(fieldName).setInstructions(instructions);
  }

  @action
  preview() {
    this.router.transitionTo('cards.card.edit.layout', this.card);
  }

  @action
  delete() {
    this.deleteCard.perform();
  }

  @action
  initDrag() {
    this.isDragging = true;
  }

  @action selectField(field, evt) {
    if (field && field.isDestroyed) {
      return;
    }

    // Toggling the selected field in tests is baffling me, using something more brute force
    if (environment === 'test' && this.selectedField === field) {
      return;
    }

    // we have to focus the clicked element to take focus away from the card.
    // to do that we have to give the element tabindex = 0 temporarily.
    // but if the element already has a tabindex (i.e. an input), we need
    // to make sure not to clobber it's original tabindex
    let tabIndex = evt.target.tabIndex;
    if (tabIndex === -1) {
      evt.target.tabIndex = 0;
      evt.target.focus();
      evt.target.blur();
      evt.target.tabIndex = tabIndex;
    } else {
      evt.target.focus();
    }

    this.selectedField = field;
    this.cardSelected = false;
  }

  *transition({ keptSprites }) {
    let activeSprite = keptSprites.find(sprite => sprite.owner.value.dragState);
    let others = keptSprites.filter(sprite => sprite !== activeSprite);

    if (activeSprite) {
      drag(activeSprite, {
        others,
      });
      let ghostElement = getGhostFromSprite(activeSprite);
      activeSprite.element.parentElement.appendChild(ghostElement);
      others.forEach(move);
    } else {
      let droppedSprite = keptSprites.find(sprite => sprite.owner.value.dropTo);
      if (droppedSprite) {
        let scaleTo = 0.1;
        let dropZoneEl = droppedSprite.owner.value.dropTo;
        let position = parseInt(dropZoneEl.dataset.dropZonePosition) + 1;
        let targetField = document.querySelector(
          `.isolated-card section.field-renderer--wrapper:nth-of-type(${position}) .schema-field-renderer`
        );
        let { width, height } = targetField.getBoundingClientRect();
        droppedSprite.endTranslatedBy(((1 - scaleTo) / 2) * width, ((1 - scaleTo) / 2) * height);
        yield parallel(scaleBy(droppedSprite, { by: scaleTo }), move(droppedSprite), fadeOut(droppedSprite));
        droppedSprite.owner.value.dropTo = null;
      }
    }
  }
}

function getGhostFromSprite(sprite) {
  let ghostElement = sprite.element.cloneNode(true);
  for (let [key, value] of Object.entries(sprite.initialComputedStyle)) {
    ghostElement.style[key] = value;
  }
  let { top, left } = sprite.initialBounds;
  ghostElement.style.position = 'fixed';
  ghostElement.style.top = top;
  ghostElement.style.left = left;
  ghostElement.style.zIndex = '0';
  ghostElement.style.opacity = '0.4';
  ghostElement.id = 'ghost-element';

  return ghostElement;
}
