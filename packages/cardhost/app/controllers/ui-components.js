import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { task } from 'ember-concurrency';

export default class UIComponentsController extends Controller {
  cardstackSession = { isAuthenticated: true };

  @tracked isChecked;

  @task(function*() {})
  noopTask;

  @action
  noop() {}

  @action
  setChecked(field, val) {
    this[field] = val;
  }
}
