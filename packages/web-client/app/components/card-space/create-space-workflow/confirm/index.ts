import Component from '@glimmer/component';
import { action } from '@ember/object';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';
import { task, TaskGenerator } from 'ember-concurrency';
import { inject as service } from '@ember/service';
// import { tracked } from '@glimmer/tracking';
import config from '@cardstack/web-client/config/environment';
import HubAuthentication from '@cardstack/web-client/services/hub-authentication';
import { taskFor } from 'ember-concurrency-ts';
// import { reads } from 'macro-decorators';
import { tracked } from '@glimmer/tracking';
interface PersistCardSpaceTaskParams {
  url: string;
  profileName: string;
  profileDescription: string;
  profileCategory: string;
  profileButtonText: string;
  profileImageUrl: string;
  profileCoverImageUrl: string;
}

class CreateSpaceWorkflowDetailsComponent extends Component<WorkflowCardComponentArgs> {
  @service declare hubAuthentication: HubAuthentication;
  // @reads('persistCardSpaceTask.last.error') declare error: Error | undefined;
  @tracked errors: any = null;

  get ctaState() {
    if (this.args.isComplete) {
      return 'memorialized';
    } else if (taskFor(this.persistCardSpaceTask).isRunning) {
      return 'in-progress';
    } else {
      return 'default';
    }
  }

  @action createCardSpace() {
    let workflowSession = this.args.workflowSession;

    let params = {
      url: workflowSession.getValue<string>('url')!,
      profileName: 'James',
      profileDescription: 'Test profile description',
      profileCategory: workflowSession.getValue<string>('profileCategory')!,
      profileButtonText: workflowSession.getValue<string>('buttonText')!,
      profileImageUrl: 'https://picsum.photos/200/300',
      profileCoverImageUrl: 'https://picsum.photos/200/300',
    };

    taskFor(this.persistCardSpaceTask).perform(params);
  }

  @task *persistCardSpaceTask(
    params: PersistCardSpaceTaskParams
  ): TaskGenerator<void> {
    let response = yield fetch(`${config.hubURL}/api/card-spaces`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + this.hubAuthentication.authToken,
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
      },
      body: JSON.stringify({
        data: {
          type: 'card-spaces',
          attributes: {
            url: params.url,
            'profile-name': params.profileName,
            'profile-description': params.profileDescription,
            'profile-category': params.profileCategory,
            'profile-button-text': params.profileButtonText,
            'profile-image-url': params.profileImageUrl,
            'profile-cover-image-url': params.profileCoverImageUrl,
          },
        },
      }),
    });
    let responseJson = yield response.json();

    if (responseJson.errors) {
      this.errors = responseJson.errors;
    } else {
      this.args.onComplete?.();
    }
  }
}

export default CreateSpaceWorkflowDetailsComponent;
