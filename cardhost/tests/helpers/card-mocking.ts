import { Server } from './../../types/ember-cli-mirage/index.d';
import { RawCard } from './../../../core/src/interfaces';
import startMirage from 'ember-cli-mirage/start-mirage';
import settled from '@ember/test-helpers/settled';

let server: Server;

export default function setupCardMocking(hooks: NestedHooks): void {
  hooks.beforeEach(function () {
    server = this.server = startMirage(this.owner);
  });

  hooks.afterEach(function () {
    return settled().then(() => {
      if (this.server) {
        this.server.shutdown();
        delete this.server;
      }
    });
  });
}

export function createCard(card: RawCard): void {
  server.create('card', { id: card.url, raw: card });
}
