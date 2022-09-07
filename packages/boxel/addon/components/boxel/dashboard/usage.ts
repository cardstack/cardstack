import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class BoxelDashboardComponent extends Component {
  @tracked displayLeftEdge = true;
  @tracked darkTheme = true;

  @tracked leftEdgeWidth = '5rem';
  @tracked backgroundColor = 'inherit';
  @tracked color = 'inherit';
}
