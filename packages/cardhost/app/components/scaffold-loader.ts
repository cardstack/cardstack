import Component from '@glimmer/component';
// @ts-ignore
import { dasherize } from '@ember/string';
// @ts-ignore
import { tracked } from '@glimmer/tracking';
import { Card } from '@cardstack/core/card';
// @ts-ignore
import { task } from 'ember-concurrency';

export default class ScaffoldLoader extends Component<{
  card: Card;
  feature: string;
}> {
  @tracked componentName!: string | undefined;

  constructor(owner: unknown, args: any) {
    super(owner, args);
    this.loadCard.perform();
  }

  @task(function*(this: ScaffoldLoader) {
    if (!this.args.card || !this.args.feature) {
      return;
    }
    let csId: string | undefined;
    if (this.args.card.csId) {
      csId = this.args.card.csId;
    } else {
      let parent = yield this.args.card.adoptsFrom();
      csId = parent.csId;
    }

    this.componentName = `scaffolding/${dasherize(csId!)}/${dasherize(this.args.feature)}`;
  })
  loadCard: any;
}
