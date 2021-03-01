/* eslint-disable no-console */
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class extends Component {
  @tracked ctaText;
  @tracked prompt;
  @action log(text) {
    console.log(text);
  }
}
