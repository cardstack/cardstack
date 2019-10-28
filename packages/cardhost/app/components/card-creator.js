import { action } from '@ember/object';
import { dasherize } from '@ember/string';
import CardManipulator from "./card-manipulator";

export default class CardCreator extends CardManipulator {
  @action
  updateCardId(id) {
    this.card = this.data.createCard(id, 'isolated');
  }

  get sanitizedType() {
    return this.selectedField.type.replace(/::/g, '/').replace(/@/g, '');
  }

  get fieldEditor() {
    return `fields/${dasherize(this.sanitizedType)}-editor`;
  }
}