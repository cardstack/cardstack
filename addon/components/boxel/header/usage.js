import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class BoxelHeaderComponent extends Component {
  @tracked hasBackground = false;
  @tracked headerPadding = 'var(--boxel-sp-xxxs) var(--boxel-sp-sm)';
  @tracked headerBackgroundColor = 'var(--boxel-purple-100)';
  @tracked headerColor = 'var(--boxel-purple-400)';
  @tracked headerMinHeight = '1.875rem';
}
