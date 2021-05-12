/* eslint-disable ember/no-empty-glimmer-component-classes */
import Component from '@glimmer/component';
import { action } from '@ember/object';

class CardPayDepositWorkflowNextStepsComponent extends Component {
  @action openNewDepositWorkflow() {
    console.log('Open new deposit workflow');
  }

  @action returnToDashboard() {
    console.log('Return to dashboard');
  }
}

export default CardPayDepositWorkflowNextStepsComponent;
