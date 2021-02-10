/* eslint-disable no-console */
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class extends Component {
  @tracked primary = false;
  @tracked dropdownIcon = false;
  @tracked disabled = false;
  @tracked collectionStyle = false;
  @action log(text) {
    console.log(text);
  }
}
