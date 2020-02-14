import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';

export interface CardstackSession {
  isAuthenticated: boolean;
}

export default class CardstackSessionService extends Service {
  @tracked isAuthenticated = true;

  login() {
    this.isAuthenticated = true;
  }

  logout() {
    this.isAuthenticated = false;
  }
}
