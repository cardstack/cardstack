import Component from '@glimmer/component';
import { action } from '@ember/object';

export default class BoxelDropdownUsage extends Component {
  @action log(string: string): void {
    console.log(string);
  }
}
