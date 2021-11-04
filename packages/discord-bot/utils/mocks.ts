/* global expect */

import { Collection, MockGuildMember, MockRole, MockUser } from '..';
import { MockGuild, MockMessage } from '../types';

export const noReply = (msg: any) => {
  expect.fail(`Received unexpected reply ${JSON.stringify(msg)}`);
};
export const noSend = (msg: any) => {
  expect.fail(`Received unexpected send ${JSON.stringify(msg)}`);
};
export const noDM = () => {
  expect.fail(`DM channel was unexpectedly created`);
};

export function makeTestMessage({
  id = '1',
  content,
  user,
  guild,
  channel = makeTestChannel(),
  userRoles = new Collection<string, MockRole>(),
  onReply,
  onCreateDM = noDM,
}: {
  id?: string;
  content: string;
  user: MockUser;
  channel?: MockChannel;
  guild?: MockGuild;
  userRoles?: Collection<string, MockRole>;
  onReply?: MockMessage['reply'];
  onCreateDM?: MockGuildMember['createDM'];
}): MockMessage {
  return {
    id,
    content,
    author: user,
    channel,
    reply: async (msg) => {
      channel.responses.push(msg);
      return await (onReply ? onReply(msg) : Promise.resolve());
    },
    ...(guild ? { guild } : {}),
    ...(guild ? { member: { id: user.id, user, createDM: () => onCreateDM(), roles: { cache: userRoles } } } : {}),
  };
}

export function makeTestChannel({
  id = '1',
  type = 'text',
  onSend,
}: {
  id?: string;
  type?: string;
  onSend?: MockChannel['send'];
} = {}): MockChannel {
  return new MockChannel({ id, type, onSend });
}

export class MockChannel {
  readonly responses: any[] = [];
  readonly id: string = '1';
  readonly type: string = 'text';
  readonly onSend: ((msg: any) => Promise<unknown>) | undefined;

  constructor({ id, type, onSend }: { id?: string; type?: string; onSend?: MockChannel['send'] }) {
    this.id = id ?? this.id;
    this.type = type ?? this.type;
    this.onSend = onSend;
  }

  // I'm being really loose with what a message item is, if we want to nail it
  // down there is a large pile of stuff this could be, but I didn't want to
  // make the mock too heavyweight
  async send(msg: any): Promise<unknown> {
    this.responses.push(msg);
    return await (this.onSend ? this.onSend(msg) : Promise.resolve());
  }

  get lastResponse(): any {
    if (this.responses.length === 0) {
      return undefined;
    }
    return this.responses[this.responses.length - 1];
  }
}

export function makeTestGuild({
  id = '1',
  roles = new Collection<string, MockRole>(),
}: {
  id?: string;
  roles?: Collection<string, MockRole>;
} = {}): MockGuild {
  return {
    id,
    roles: {
      cache: roles,
    },
  };
}
