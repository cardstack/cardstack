import CardManipulator from "./card-manipulator";
import { action } from '@ember/object';
export default class CardSchemaUpdator extends CardManipulator {
  @action
  doNothing() {}
}