import Component from '@glimmer/component';
import { dasherize } from '@ember/string';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

// TODO we'll need to use EC in order to be able to isolate cards
// (due to the need to await the load of the isolated format of a card)
// import { task } from "ember-concurrency";

// TODO This will be part of the official API. Move this into core as it solidifies
export default class CardRenderer extends Component {
  @tracked componentName;
  @tracked mode;
  @tracked cardFocused = () => {};

  constructor(...args) {
    super(...args);

    // TODO eventually this will be derived based on the presence of a card's
    // custom template/component assets, and we'll use the @card.id for the
    // component name
    this.componentName = '@cardstack/base-card';
    this.mode = this.args.mode || 'view';

    if (this.args.cardFocused) {
      this.cardFocused = this.args.cardFocused;
    }
  }

  @action
  cardIsFocused(value) {
    this.cardFocused(value);
  }

  @action
  focusCard(element, [value]) {
    this.cardFocused(value);
  }

  get sanitizedName() {
    return this.componentName.replace(/@/g, '');
  }

  get embeddedComponentName() {
    return `cards/${dasherize(this.sanitizedName)}/embedded`;
  }

  get isolatedComponentName() {
    return `cards/${dasherize(this.sanitizedName)}/isolated`;
  }
}