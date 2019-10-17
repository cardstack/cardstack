import Component from '@glimmer/component';
import { dasherize } from '@ember/string';
import { tracked } from '@glimmer/tracking';

// TODO we'll need to use EC in order to be able to isolate cards
// (due to the need to await the load of the isolated format of a card)
// import { task } from "ember-concurrency";

// TODO This will be part of the official API. Move this into core as it solidifies
export default class CardRenderer extends Component {
  @tracked componentName;
  @tracked mode;

  constructor(...args) {
    super(...args);

    // TODO eventually this will be derived based on the presence of a card's
    // custom template/component assets.
    this.componentName = 'default';
    this.mode = this.args.mode || 'view';
  }

  get embeddedComponentName() {
    return `cards/${dasherize(this.componentName)}/embedded`;
  }

  get isolatedComponentName() {
    return `cards/${dasherize(this.componentName)}/isolated`;
  }
}