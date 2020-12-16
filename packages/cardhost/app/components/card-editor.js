import CardManipulator from './card-manipulator';
import moment from 'moment';

export default class CardEditor extends CardManipulator {
  get updated() {
    // This is needed because sending empty strings or null to the moment helper
    // causes warnings. It ensures the helper always receives a date.
    if (this.args.card && this.args.card.csUpdated) {
      return this.args.card.csUpdated;
    } else {
      return moment();
    }
  }
}
