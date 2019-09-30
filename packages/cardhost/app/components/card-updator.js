import CardManipulator from "./card-manipulator";

export default class CardUpdator extends CardManipulator {

  get isDirtyStr() {
    return this.card.isDirty.toString();
  }

  async afterUpdate() {
    await this.args.onCardUpdate();
  }
}