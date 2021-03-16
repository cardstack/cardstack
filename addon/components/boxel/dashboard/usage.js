import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class BoxelDashboardComponent extends Component {
  @tracked displayLeftEdge = false;
  @tracked darkTheme = false;
  @tracked backgroundColor = 'var(--boxel-light-100)';
  @tracked color = 'var(--boxel-dark)';
  @tracked headerBackgroundColor = 'var(--boxel-dark)';
  @tracked headerColor = 'var(--boxel-light)';
}
