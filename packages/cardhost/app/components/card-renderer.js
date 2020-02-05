import Component from '@glimmer/component';
import { dasherize } from '@ember/string';
import { A } from '@ember/array';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import move from 'ember-animated/motions/move';
import adjustCSS from 'ember-animated/motions/adjust-css';

// TODO we'll need to use EC in order to be able to isolate cards
// (due to the need to await the load of the isolated format of a card)
// import { task } from "ember-concurrency";

const duration = 250;
// TODO This will be part of the official API. Move this into core as it solidifies
export default class CardRenderer extends Component {
  @tracked componentName;
  @tracked mode;
  @tracked cardFocused = () => {};
  @tracked fields = A([]);

  duration = duration;

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

    if (this.args.card && this.args.format === 'isolated') {
      this.fields = A(Object.assign([], this.args.card.isolatedFields));
    }
  }

  @action
  updateFields(element, [fields]) {
    if (this.args.mode === 'schema') {
      this.fields = A(Object.assign([], fields));
    }
  }

  @action
  toggleStubField(field, position, addField) {
    if (position || position === 0) {
      if (addField) {
        this.fields.insertAt(position, field);
      } else {
        this.fields.removeAt(position);
      }
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

  *headerAnimation({ keptSprites }) {
    keptSprites.forEach(sprite => {
      move(sprite, { duration });
    });
  }

  *borderAnimation({ keptSprites }) {
    keptSprites.forEach(sprite => {
      adjustCSS('border-top-right-radius', sprite, { duration });
      adjustCSS('border-top-left-radius', sprite, { duration });
    });
  }
}
