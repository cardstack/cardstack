/* eslint-disable ember/no-empty-glimmer-component-classes */
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

const COLOR_OPTIONS = [
  { title: 'Navy', value: '#281e78', theme: 'dark' },
  { title: 'Blue', value: '#0069f9', theme: 'dark' },
  { title: 'Purple', value: '#6638ff', theme: 'dark' },
  { title: 'Fuschia', value: 'var(--boxel-fuschia)', theme: 'dark' },
  { title: 'Lilac', value: '#a66dfa' },
  { title: 'Cyan', value: '#00ebe5' },
  { title: 'Teal', value: '#03c4bf' },
  { title: 'Green', value: '#37eb77' },
  { title: 'Neon green', value: 'var(--boxel-lime)' },
  { title: 'Yellow', value: '#ffd800' },
  { title: 'Orange', value: '#ff7f00' },
  { title: 'Red', value: '#ff5050' },
  { title: 'Pink', value: '#ff009d' },
  {
    title: 'Gradient A',
    value: 'linear-gradient(145deg, var(--boxel-red), var(--boxel-fuschia))',
    theme: 'dark',
  },
];

const PATTERN_OPTIONS = [{ title: 'None', value: 'none' }];

export default class extends Component {
  colorOptions = COLOR_OPTIONS;
  patternOptions = PATTERN_OPTIONS;
  @tracked isComplete = false;
  @tracked issuerName = 'Gary Walker';
  @tracked headerColor = this.colorOptions[8];
  @tracked headerPattern = this.patternOptions[0];

  @action
  updateHeaderColor(val) {
    return (this.headerColor = val);
  }

  @action
  updateHeaderPattern(val) {
    return (this.headerPattern = val);
  }
}
