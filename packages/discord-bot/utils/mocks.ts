import { Collection, MockChannel, MockGuildMember, MockRole, MockUser } from '..';
import { MockGuild, MockMessage } from '../types';

const noReply = (msg: any) => {
  expect.fail(`Received unexpected reply ${JSON.stringify(msg)}`);
};
const noSend = (msg: any) => {
  expect.fail(`Received unexpected send ${JSON.stringify(msg)}`);
};
const noDM = () => {
  expect.fail(`DM was unexpectedly created`);
};

export function makeTestMessage({
  id = '1',
  content,
  user,
  guild,
  channel = makeTestChannel(),
  userRoles = new Collection<string, MockRole>(),
  onReply = noReply,
  onCreateDM = noDM,
}: {
  id?: string;
  content: string;
  user: MockUser;
  channel?: MockChannel;
  guild?: MockGuild;
  userRoles?: Collection<NamedCurve, MockRole>;
  onReply?: MockMessage['reply'];
  onCreateDM?: MockGuildMember['createDM'];
}): MockMessage {
  return {
    id,
    content,
    author: user,
    channel,
    reply: (msg) => onReply(msg),
    ...(guild ? { guild } : {}),
    ...(guild ? { member: { id: user.id, user, createDM: () => onCreateDM(), roles: { cache: userRoles } } } : {}),
  };
}

export function makeTestChannel({
  id = '1',
  type = 'text',
  onSend = noSend,
}: {
  id?: string;
  type?: string;
  onSend?: MockChannel['send'];
} = {}): MockChannel {
  return {
    id,
    type,
    send: (msg) => onSend(msg),
  };
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
