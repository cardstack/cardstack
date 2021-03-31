/* eslint-disable no-console */
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class extends Component {
  @tracked ctaText: string | undefined;
  @tracked prompt: string | undefined;
  @action log(text: string): void {
    console.log(text);
  }
}
