import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class BoxelHeaderComponent extends Component {
  @tracked header = 'Header';
  @tracked selectionHeader = false;
  @tracked isSelected = false;
  @tracked editable = false;
  @tracked hasContextMenu = false;
  @tracked expandable = false;
  @tracked noBackground = false;
}
