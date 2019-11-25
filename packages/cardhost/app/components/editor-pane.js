import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class EditorPane extends Component {
  @tracked dockLocation = "bottom";

  @action
  dockRight() {
    this.dockLocation = "right";
  }

  @action
  dockBottom() {
    this.dockLocation = "bottom";
  }

}