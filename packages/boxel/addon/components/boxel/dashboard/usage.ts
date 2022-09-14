import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class DashboardUsage extends Component {
  @tracked displayLeftEdge = true;
  @tracked darkTheme = true;

  @tracked backgroundColor = 'inherit';
  @tracked color = 'inherit';
}
