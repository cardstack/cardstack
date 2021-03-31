/* eslint-disable no-console */
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
export default class extends Component {
  sizeVariants = ['small', 'base', 'tall', 'touch'];
  kindVariants = {
    all: ['primary', 'secondary-light', 'secondary-dark'],
    light: ['primary', 'secondary-light'],
    dark: ['primary', 'secondary-dark'],
  };

  @tracked size = 'base';
  @tracked kind = 'primary';
  @tracked disabled = false;

  @action
  alert(): void {
    alert('Hey! You clicked the button.');
  }
}
