import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class BoxelDashboardUsage extends Component {
  @tracked displayLeftEdge = true;
  @tracked darkTheme = true;
}
