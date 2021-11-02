import Component from '@glimmer/component';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { restartableTask, timeout } from 'ember-concurrency';
import config from '@cardstack/web-client/config/environment';
import { taskFor } from 'ember-concurrency-ts';
import HubAuthentication from '@cardstack/web-client/services/hub-authentication';
import { inject as service } from '@ember/service';
import * as Sentry from '@sentry/browser';
import { InputValidationState } from '@cardstack/web-client/components/common/validation-state-input';

class CreateSpaceWorkflowEditDetailsUrlComponent extends Component<WorkflowCardComponentArgs> {
  @service declare hubAuthentication: HubAuthentication;
  @tracked subdomain: string = '';
  @tracked url: string = '';
  @tracked urlValidationState: InputValidationState = 'initial';
  @tracked urlValidationMessage: string = '';

  @action restoreFromSession() {
    let url = this.args.workflowSession.getValue<string>('url');
    if (url) {
      this.subdomain = url.replace('.card.space', '');
      this.url = url;
      this.validateUrl();
    }
  }

  @action onSubdomainInput(value: string) {
    this.url = `${value}.card.space`;
    this.validateUrl();
  }

  @action async validateUrl() {
    try {
      await taskFor(this.validateUrlTask).perform();
    } catch (e) {
      console.error(e);
    }
  }

  @restartableTask *validateUrlTask(): any {
    let url = this.url;
    this.urlValidationState = 'loading';

    yield timeout(config.environment === 'test' ? 10 : 500); // debounce

    try {
      let response = yield fetch(
        `${config.hubURL}/api/card-spaces/validate-url`,
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer: ' + this.hubAuthentication.authToken,
            Accept: 'application/vnd.api+json',
            'Content-Type': 'application/vnd.api+json',
          },
          body: JSON.stringify({ data: { attributes: { url } } }),
        }
      );

      let { errors } = yield response.json();

      if (errors.length === 0) {
        this.urlValidationState = 'valid';
        this.urlValidationMessage = 'URL available';
        this.args.workflowSession.setValue('url', url);
      } else {
        this.urlValidationState = 'invalid';
        this.urlValidationMessage = errors[0].detail;
        this.args.workflowSession.delete('url');
      }
    } catch (e) {
      console.error('Error validating card space url', e);
      Sentry.captureException(e);
      this.args.workflowSession.delete('url');
      this.urlValidationState = 'invalid';
      this.urlValidationMessage =
        'There was an error validating your card space url. Please try again or contact support';
    }
  }
}

export default CreateSpaceWorkflowEditDetailsUrlComponent;
