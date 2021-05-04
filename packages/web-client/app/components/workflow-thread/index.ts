import Component from '@glimmer/component';
import { action } from '@ember/object';

export default class WorkflowThread extends Component {
  @action focus(element: HTMLElement): void {
    element.focus();
  }
}
