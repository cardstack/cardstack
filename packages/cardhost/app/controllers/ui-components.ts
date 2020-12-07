import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
//@ts-ignore
import { task } from 'ember-concurrency';

export default class UIComponentsController extends Controller {
  cardstackSession = { isAuthenticated: true };

  @tracked isChecked = false;

  @task(function*() {})
  noopTask: any;

  @action
  noop() {}
}
