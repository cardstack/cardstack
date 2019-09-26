// import { inject as service } from '@ember/service';
// import { action } from '@ember/object';
// import { tracked } from '@glimmer/tracking';
import CardManipulator from "./card-manipulator";

export default class CardUpdator extends CardManipulator {

  get isDirtyStr() {
    return this.card.isDirty.toString();
  }

  async afterUpdate() {
    await this.args.onCardUpdate();
  }
}