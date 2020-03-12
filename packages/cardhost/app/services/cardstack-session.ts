import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';

export interface CardstackSession {
  isAuthenticated: boolean;
  username: string | undefined;
}

// This is just a mock until we have the real thing ready
export default class CardstackSessionService extends Service {
  @tracked isAuthenticated = true;
  @tracked username: string | undefined;

  login(username: string) {
    this.isAuthenticated = true;
    this.username = username;
  }

  logout() {
    this.isAuthenticated = false;
    this.username = undefined;
  }
}
