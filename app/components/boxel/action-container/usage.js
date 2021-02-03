import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class extends Component {
  @tracked isComplete = false;
  @tracked header = 'Prepaid Card Funding';
  @tracked prompt = 'Choose the face value of your Prepaid Card';
  @tracked incompleteActionLabel = 'Save';
  @tracked completeActionLabel = 'Edit value';
  @tracked faceValue;
}
