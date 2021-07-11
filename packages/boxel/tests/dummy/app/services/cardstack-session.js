import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

// mock session service
export default class CardstackSessionService extends Service {
  @tracked isAuthenticated = false;

  @action
  login() {
    this.isAuthenticated = true;
  }

  @action
  logout() {
    this.isAuthenticated = false;
  }
}
