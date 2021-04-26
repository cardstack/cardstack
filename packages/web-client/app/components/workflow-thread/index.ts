import Component from '@glimmer/component';
import { action } from '@ember/object';

export default class WorkflowThread extends Component {
  @action focus(element: any) {
    element.focus();
  }
}
