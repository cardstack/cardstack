/* eslint-disable no-console */
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import './usage.css';

export default class extends Component {
  sizeVariants = ['extra-small', 'small', 'base', 'tall', 'touch'];
  kindVariants = {
    all: ['primary', 'secondary-light', 'secondary-dark'],
    light: ['primary', 'secondary-light'],
    dark: ['primary', 'secondary-dark'],
  };

  // base button arguments
  @tracked as = 'button';
  @tracked size = 'base';
  @tracked kind = 'primary';
  @tracked disabled = false;
  @tracked loading = false;

  // for @as === 'anchor'
  @tracked href = '#';

  // for @as === 'link-to'
  @tracked route = 'docs.index';
  // @model and @query seem hard to use here so leaving them aside for now

  @action
  alert(): void {
    alert('Hey! You clicked the button.');
  }
}
