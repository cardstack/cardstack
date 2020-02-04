import Component from '@glimmer/component';
// @ts-ignore
import { dasherize } from '@ember/string';
import { Card } from '@cardstack/core/card';

export default class ScaffoldLoader extends Component<{
  card: Card;
  feature: string;
}> {
  get componentName() {
    if (!this.args.card || !this.args.feature) {
      return null;
    }
    return `scaffolding/${dasherize(this.args.card.csId!)}/${dasherize(this.args.feature)}`;
  }
}
