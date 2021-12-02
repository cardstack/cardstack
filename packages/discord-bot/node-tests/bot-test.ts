import { Client } from 'pg';
import Bot, { Command, Message, MockGuild } from '..';
import {
  DiscordBotsDbGateway,
  DiscordBotStatus,
  DmChannelsDbGateway,
  MockMessage,
  MockUser,
  NotificationCallback,
  Snowflake,
  SUUID,
} from '../types';
import sinon, { SinonStub } from 'sinon';
import { makeTestMessage, makeTestChannel, makeTestGuild, MockChannel } from '../utils/mocks';

function defer<T>() {
  let _resolve: (val?: T) => void;
  let _reject: (e: Error) => void;
  let promise = new Promise((res, rej) => {
    [_resolve, _reject] = [res, rej];
  });
  return {
    promise,
    reject: (e: Error) => _reject(e),
    resolve: (val?: T) => {
      _resolve(val);
    },
  };
}

describe('DiscordBot', function () {
  let bot: Bot;
  let basicConfig = {
    botId: '',
    botToken: 'abc123',
    cordeBotId: '',
    cordeBotToken: '',
    commandPrefix: '',
    commandsDir: '',
    allowedChannels: '1',
    allowedGuilds: '1',
    messageVerificationDelayMs: 25,
  };

  class FakeDiscordBotsDbGateway implements DiscordBotsDbGateway {
    lastStatus?: DiscordBotStatus;
    lastMessageId?: Snowflake;
    listeningChannels: Map<string, NotificationCallback> = new Map();
    listenerBotId?: SUUID;
    onBecomeListener?: () => Promise<boolean>;

    getDatabaseClient(): Promise<Client> {
      throw new Error('Method not implemented.');
    }
    async updateStatus(status: DiscordBotStatus, _botInstanceId: string): Promise<void> {
      this.lastStatus = status;
      return Promise.resolve();
    }
    async updateLastMessageProcessed(messageId: string, _botInstanceId: string): Promise<void> {
      this.lastMessageId = messageId;
      return Promise.resolve();
    }
    async subscribe(channel: string, _botType: string, callback: NotificationCallback): Promise<void> {
      this.listeningChannels.set(channel, callback);
      return Promise.resolve();
    }

    async unsubscribe(channel: string, _botType: string): Promise<void> {
      this.listeningChannels.delete(channel);
      return Promise.resolve();
    }

    async becomeListener(botInstanceId: SUUID): Promise<boolean> {
      let result = true;
      if (this.onBecomeListener) {
        result = await this.onBecomeListener();
      }
      if (result) {
        this.listenerBotId = botInstanceId;
      }
      return result;
    }

    simulateChannelNotification(channelId: string, payload: any) {
      let callback = this.listeningChannels.get(channelId);
      callback?.(payload);
    }

    async getLastMessageIdProcessed(_type: string): Promise<Snowflake | null> {
      return Promise.resolve(this.lastMessageId || null);
    }

    async getCurrentListenerId(_type: string): Promise<SUUID | null> {
      return Promise.resolve(this.listenerBotId || null);
    }
  }

  class FakeDmChannelsDbGateway implements DmChannelsDbGateway {
    onConversationCommand?: (channelId: string) => Promise<string | undefined>;
    onActivateDMConversation?: (channelId: string, userId: string, commandName: string) => Promise<void>;

    async conversationCommand(channelId: string): Promise<string | undefined> {
      let result: string | undefined = undefined;
      if (this.onConversationCommand) {
        result = await this.onConversationCommand(channelId);
      }
      return result;
    }

    async activateDMConversation(channelId: string, userId: string, commandName: string): Promise<void> {
      if (this.onActivateDMConversation) {
        await this.onActivateDMConversation(channelId, userId, commandName);
      }
    }

    deactivateDMConversation(_channelId: string, _userId: string): Promise<void> {
      throw new Error('Method not implemented.');
    }
  }

  class PingCommand implements Command {
    name = 'ping';
    async run(_client: Bot, message: Message) {
      message.channel.send('pong');
    }
    aliases = [];
    description = 'ping pong';
  }

  class BarCommand implements Command {
    name = 'foo';
    async run(_client: Bot, message: Message) {
      message.channel.send('bar');
    }
    aliases = [];
    description = 'foo bar';
  }

  const dmCommands = new Map<string, Command>([['!foo', new BarCommand()]]);
  const guildCommands = new Map<string, Command>([['!ping', new PingCommand()]]);

  let discordBotsDbGateway: FakeDiscordBotsDbGateway;
  let dmChannelsDbGateway: FakeDmChannelsDbGateway;
  let loginStub: SinonStub;

  beforeEach(async function () {
    discordBotsDbGateway = new FakeDiscordBotsDbGateway();
    dmChannelsDbGateway = new FakeDmChannelsDbGateway();
  });

  afterEach(async function () {
    loginStub?.restore();
    bot.destroy();
  });

  describe('starting', function () {
    it('fails without config set', async function () {
      bot = new Bot();
      await expect(bot.start()).to.be.rejectedWith('config property must be set before starting the bot');
      expect(bot.status).to.eq('disconnected');
    });

    it('fails without discordBotsDbGateway set', async function () {
      bot = new Bot();
      bot.config = basicConfig;
      await expect(bot.start()).to.be.rejectedWith('discordBotsDbGateway property must be set before starting the bot');
      expect(bot.status).to.eq('disconnected');
    });

    it('fails with no commands discovered', async function () {
      bot = new Bot();
      bot.config = basicConfig;
      bot.discordBotsDbGateway = discordBotsDbGateway;
      bot.dmChannelsDbGateway = dmChannelsDbGateway;
      await expect(bot.start()).to.be.rejectedWith('No bot commands found. Check your configuration.');
      expect(bot.status).to.eq('disconnected');
    });

    it('does not log in without a botToken configured', async function () {
      bot = new Bot();
      bot.config = {
        botId: '',
        botToken: '',
        cordeBotId: '',
        cordeBotToken: '',
        commandPrefix: '',
        allowedChannels: '',
        allowedGuilds: '',
        messageVerificationDelayMs: 25,
      };
      bot.discordBotsDbGateway = discordBotsDbGateway;
      bot.dmChannelsDbGateway = dmChannelsDbGateway;
      bot.dmCommands = dmCommands;
      bot.guildCommands = guildCommands;
      loginStub = sinon.stub(bot, 'login');
      await bot.start();
      expect(loginStub.callCount).to.equal(0);
      expect(bot.status).to.eq('connecting');
    });

    it('logs in with the configured botToken', async function () {
      bot = new Bot();
      bot.config = basicConfig;
      bot.discordBotsDbGateway = discordBotsDbGateway;
      bot.dmChannelsDbGateway = dmChannelsDbGateway;
      bot.dmCommands = dmCommands;
      bot.guildCommands = guildCommands;
      loginStub = sinon.stub(bot, 'login');
      await bot.start();
      expect(loginStub.callCount).to.equal(1);
      expect(loginStub.args).to.deep.eq([['abc123']]);
    });

    it('updates its database status to "connecting" before logging in to Discord', async function () {
      bot = new Bot();
      bot.config = basicConfig;
      bot.discordBotsDbGateway = discordBotsDbGateway;
      bot.dmChannelsDbGateway = dmChannelsDbGateway;
      bot.dmCommands = dmCommands;
      bot.guildCommands = guildCommands;
      loginStub = sinon.stub(bot, 'login');
      let loginDeferred = defer();
      loginStub.returns(loginDeferred.promise);
      bot.start();
      await new Promise((resolve) => setTimeout(resolve, 25));
      expect(discordBotsDbGateway.lastStatus).to.equal('connecting');
      loginDeferred.resolve();
      expect(bot.status).to.eq('connecting');
    });

    it('updates its database status to "connected" after logging in to Discord', async function () {
      bot = new Bot();
      bot.config = basicConfig;
      bot.discordBotsDbGateway = discordBotsDbGateway;
      bot.dmChannelsDbGateway = dmChannelsDbGateway;
      let deferred = defer<boolean>();
      discordBotsDbGateway.onBecomeListener = () => {
        return deferred.promise as Promise<boolean>;
      };
      bot.dmCommands = dmCommands;
      bot.guildCommands = guildCommands;
      loginStub = sinon.stub(bot, 'login');
      bot.start();
      await new Promise((resolve) => setTimeout(resolve, 25));
      expect(discordBotsDbGateway.lastStatus).to.equal('connected');
      expect(bot.status).to.eq('connected');
      await deferred.resolve(false);
    });

    it('listens for database notifications on the discord_bot_status and discord_bot_message_processing channels', async function () {
      bot = new Bot();
      bot.config = basicConfig;
      bot.discordBotsDbGateway = discordBotsDbGateway;
      bot.dmChannelsDbGateway = dmChannelsDbGateway;
      bot.dmCommands = dmCommands;
      bot.guildCommands = guildCommands;
      loginStub = sinon.stub(bot, 'login');
      await bot.start();
      expect(Array.from(discordBotsDbGateway.listeningChannels.keys())).to.deep.equal([
        'discord_bot_status',
        'discord_bot_message_processing',
      ]);
      expect(bot.status).to.eq('listening');
    });

    it('becomes the lone listening bot if it is first to request it', async function () {
      bot = new Bot();
      bot.config = basicConfig;
      bot.discordBotsDbGateway = discordBotsDbGateway;
      bot.dmChannelsDbGateway = dmChannelsDbGateway;
      bot.dmCommands = dmCommands;
      bot.guildCommands = guildCommands;
      loginStub = sinon.stub(bot, 'login');
      await bot.start();
      expect(Array.from(discordBotsDbGateway.listeningChannels.keys())).to.deep.equal([
        'discord_bot_status',
        'discord_bot_message_processing',
      ]);
      expect(bot.status).to.eq('listening');
      expect(discordBotsDbGateway.listenerBotId).to.eq(bot.botInstanceId);
    });

    it('does not become the listening bot if another bot already is listening', async function () {
      bot = new Bot();
      bot.config = basicConfig;
      bot.discordBotsDbGateway = discordBotsDbGateway;
      bot.dmChannelsDbGateway = dmChannelsDbGateway;
      let deferred = defer<boolean>();
      discordBotsDbGateway.onBecomeListener = () => {
        return deferred.promise as Promise<boolean>;
      };
      bot.dmCommands = dmCommands;
      bot.guildCommands = guildCommands;
      loginStub = sinon.stub(bot, 'login');
      bot.start();
      await new Promise((resolve) => setTimeout(resolve, 25));
      expect(Array.from(discordBotsDbGateway.listeningChannels.keys())).to.deep.equal([
        'discord_bot_status',
        'discord_bot_message_processing',
      ]);
      await deferred.resolve(false);
      expect(bot.status).to.eq('connected');
      expect(discordBotsDbGateway.listenerBotId).to.be.undefined;
    });
  });

  describe('when bot is in listening state', async function () {
    let user: MockUser, channel: MockChannel, guild: MockGuild;
    beforeEach(async function () {
      bot = new Bot();
      bot.config = basicConfig;
      bot.discordBotsDbGateway = discordBotsDbGateway;
      bot.dmChannelsDbGateway = dmChannelsDbGateway;
      bot.dmCommands = dmCommands;
      bot.guildCommands = guildCommands;
      loginStub = sinon.stub(bot, 'login');
      user = {
        id: 'userId',
        bot: false,
        username: 'Akiko',
      };
      channel = makeTestChannel();
      guild = makeTestGuild();
      await bot.start();
    });

    describe('handling a guild message', async function () {
      let testGuildMessage: MockMessage;
      beforeEach(async function () {
        testGuildMessage = makeTestMessage({
          guild,
          user,
          content: '!ping',
          channel,
        });
      });

      it('updates the last_message_id after processing the message', async function () {
        bot.emit('message', testGuildMessage as any);
        await new Promise((resolve) => setTimeout(resolve, 25));
        expect(discordBotsDbGateway.lastMessageId).to.equal(testGuildMessage.id);
      });

      it('runs the command', async function () {
        bot.emit('message', testGuildMessage as any);
        await new Promise((resolve) => setTimeout(resolve, 25));
        expect(discordBotsDbGateway.lastMessageId).to.equal(testGuildMessage.id);
        expect(channel.lastResponse).to.equal('pong');
      });
      it('does not schedule a message processing check', async function () {
        bot.emit('message', testGuildMessage as any);
        await new Promise((resolve) => setTimeout(resolve, 25));
        expect(bot.messageProcessingVerifier.scheduledVerificationsCount).to.equal(0);
      });
    });
    describe('handling a direct message', async function () {
      let testDirectMessage: MockMessage;
      beforeEach(async function () {
        dmChannelsDbGateway.onConversationCommand = (_channelId: string) => {
          return Promise.resolve('!foo');
        };
        channel = makeTestChannel({ type: 'dm' });
        testDirectMessage = makeTestMessage({
          user,
          content: '!foo',
          channel,
        });
      });
      it('updates the last_message_id after processing', async function () {
        bot.emit('message', testDirectMessage as any);
        await new Promise((resolve) => setTimeout(resolve, 25));
        expect(discordBotsDbGateway.lastMessageId).to.equal(testDirectMessage.id);
      });

      it('runs the command', async function () {
        bot.emit('message', testDirectMessage as any);
        await new Promise((resolve) => setTimeout(resolve, 25));
        expect(discordBotsDbGateway.lastMessageId).to.equal(testDirectMessage.id);
        expect(channel.lastResponse).to.equal('bar');
      });

      it('does not schedule a message processing check', async function () {
        bot.emit('message', testDirectMessage as any);
        await new Promise((resolve) => setTimeout(resolve, 25));
        expect(bot.messageProcessingVerifier.scheduledVerificationsCount).to.eq(0);
      });
    });
  });

  describe('when bot is not in listening state', async function () {
    let user: MockUser, channel: MockChannel, guild: MockGuild;
    beforeEach(async function () {
      bot = new Bot();
      bot.config = basicConfig;
      bot.discordBotsDbGateway = discordBotsDbGateway;
      bot.dmChannelsDbGateway = dmChannelsDbGateway;
      bot.dmCommands = dmCommands;
      bot.guildCommands = guildCommands;

      loginStub = sinon.stub(bot, 'login');
      user = {
        id: 'userId',
        bot: false,
        username: 'Akiko',
      };
      channel = makeTestChannel();
      guild = makeTestGuild();
      let deferred = defer<boolean>();
      discordBotsDbGateway.onBecomeListener = () => {
        return deferred.promise as Promise<boolean>;
      };
      bot.start();
      await new Promise((resolve) => setTimeout(resolve, 25));
      await deferred.resolve(false);
    });

    describe('handling a guild message', async function () {
      let testGuildMessage: MockMessage;
      beforeEach(async function () {
        testGuildMessage = makeTestMessage({
          guild,
          user,
          content: '!ping',
          channel,
        });
      });

      it('does not run command', async function () {
        bot.emit('message', testGuildMessage as any);
        await new Promise((resolve) => setTimeout(resolve, 25));
        expect(discordBotsDbGateway.lastMessageId).to.equal(undefined);
        expect(channel.lastResponse).to.equal(undefined);
      });

      it('schedules a check to make sure the message was processed', async function () {
        bot.emit('message', testGuildMessage as any);
        await new Promise((resolve) => setTimeout(resolve, 25));
        expect(bot.messageProcessingVerifier.scheduledVerificationsCount).to.eq(1);
      });
      describe('with a scheduled check for an unprocessed message', async function () {
        beforeEach(async function () {
          bot.emit('message', testGuildMessage as any);
          await new Promise((resolve) => setTimeout(resolve, 10));
        });
        it('cancels the check when notified that the message has been processed', async function () {
          discordBotsDbGateway.simulateChannelNotification('discord_bot_message_processing', {
            id: testGuildMessage.id,
            bot_type: 'generic',
          });
          await new Promise((resolve) => setTimeout(resolve, 25));
          expect(bot.messageProcessingVerifier.scheduledVerificationsCount).to.eq(0);
        });
      });
    });
    describe('handling a direct message', async function () {
      let testDirectMessage: MockMessage;
      beforeEach(async function () {
        dmChannelsDbGateway.onConversationCommand = (_channelId: string) => {
          return Promise.resolve('!foo');
        };
        channel = makeTestChannel({ type: 'dm' });
        testDirectMessage = makeTestMessage({
          user,
          content: '!foo',
          channel,
        });
      });

      it('does not run command if the bot is not in listening state', async function () {
        bot.emit('message', testDirectMessage as any);
        await new Promise((resolve) => setTimeout(resolve, 25));
        expect(discordBotsDbGateway.lastMessageId).to.equal(undefined);
        expect(channel.lastResponse).to.equal(undefined);
      });

      it('schedules a check to make sure the message was processed', async function () {
        bot.emit('message', testDirectMessage as any);
        await new Promise((resolve) => setTimeout(resolve, 25));
        expect(bot.messageProcessingVerifier.scheduledVerificationsCount).to.eq(1);
      });
      describe('with a scheduled check for an unprocessed message', async function () {
        beforeEach(async function () {
          bot.emit('message', testDirectMessage as any);
          await new Promise((resolve) => setTimeout(resolve, 10));
        });
        it('cancels the check when notified that the message has been processed', async function () {
          discordBotsDbGateway.simulateChannelNotification('discord_bot_message_processing', {
            id: testDirectMessage.id,
            bot_type: 'generic',
          });
          await new Promise((resolve) => setTimeout(resolve, 25));
          expect(bot.messageProcessingVerifier.scheduledVerificationsCount).to.eq(0);
        });
        it('exits the check early when discovering that the message has been processed', async function () {
          // no notification is received
          discordBotsDbGateway.lastMessageId = testDirectMessage.id;
          await new Promise((resolve) => setTimeout(resolve, 25));
          expect(bot.messageProcessingVerifier.scheduledVerificationsCount).to.eq(0);
          expect(bot.status).to.eq('connected');
        });
        it('tries successfully to become listener and process the message', async function () {
          // no notification is received
          discordBotsDbGateway.onBecomeListener = undefined;
          await new Promise((resolve) => setTimeout(resolve, 50));
          expect(bot.status).to.eq('listening');
          expect(discordBotsDbGateway.listenerBotId).to.eq(bot.botInstanceId);
          expect(discordBotsDbGateway.lastMessageId).to.equal(testDirectMessage.id);
          expect(channel.lastResponse).to.equal('bar');
          expect(bot.messageProcessingVerifier.scheduledVerificationsCount).to.eq(0);
        });
        it('tries unsuccessfully to become listener and does not process the message', async function () {
          // no notification is received
          let deferred = defer<boolean>();
          discordBotsDbGateway.onBecomeListener = () => {
            return deferred.promise as Promise<boolean>;
          };
          await new Promise((resolve) => setTimeout(resolve, 50));
          await deferred.resolve(false);
          expect(bot.status).to.eq('connected');
          await new Promise((resolve) => setTimeout(resolve, 25));
          expect(bot.messageProcessingVerifier.scheduledVerificationsCount).to.eq(1);
        });
      });
    });
    describe('handling notification that listener has disconnected', async function () {
      it('becomes the lone listening bot if it is first to request it', async function () {
        discordBotsDbGateway.onBecomeListener = undefined;
        discordBotsDbGateway.simulateChannelNotification('discord_bot_status', {
          bot_type: 'generic',
          status: 'disconnected',
        });
        await new Promise((resolve) => setTimeout(resolve, 25));
        expect(bot.status).to.eq('listening');
        expect(discordBotsDbGateway.listenerBotId).to.eq(bot.botInstanceId);
      });

      it('does not become the listening bot if another bot becomes listening first', async function () {
        let deferred = defer<boolean>();
        discordBotsDbGateway.onBecomeListener = () => {
          return deferred.promise as Promise<boolean>;
        };
        discordBotsDbGateway.simulateChannelNotification('discord_bot_status', {
          bot_type: 'generic',
          status: 'disconnected',
        });
        await new Promise((resolve) => setTimeout(resolve, 25));
        await deferred.resolve(false);
        expect(bot.status).to.eq('connected');
        expect(discordBotsDbGateway.listenerBotId).to.be.undefined;
      });
    });
  });

  describe('destroying', async function () {
    it('updates its database status to "disconnected" after being destroyed', async function () {
      bot = new Bot();
      bot.config = basicConfig;
      bot.discordBotsDbGateway = discordBotsDbGateway;
      bot.dmChannelsDbGateway = dmChannelsDbGateway;
      bot.dmCommands = dmCommands;
      bot.guildCommands = guildCommands;
      loginStub = sinon.stub(bot, 'login');
      await bot.start();
      await bot.destroy();
      await new Promise((resolve) => setTimeout(resolve, 25));
      expect(discordBotsDbGateway.lastStatus).to.equal('disconnected');
      expect(bot.status).to.eq('disconnected');
    });

    it('unlistens from discord_bot_status and discord_bot_message_processing channels', async function () {
      bot = new Bot();
      bot.config = basicConfig;
      bot.discordBotsDbGateway = discordBotsDbGateway;
      bot.dmChannelsDbGateway = dmChannelsDbGateway;
      bot.dmCommands = dmCommands;
      bot.guildCommands = guildCommands;
      loginStub = sinon.stub(bot, 'login');
      await bot.start();
      await bot.destroy();
      await new Promise((resolve) => setTimeout(resolve, 25));
      expect(Array.from(discordBotsDbGateway.listeningChannels.keys())).to.deep.equal([]);
    });

    it('cancels scheduled checks', async function () {
      bot = new Bot();
      bot.config = basicConfig;
      bot.discordBotsDbGateway = discordBotsDbGateway;
      bot.dmChannelsDbGateway = dmChannelsDbGateway;
      bot.dmCommands = dmCommands;
      bot.guildCommands = guildCommands;
      loginStub = sinon.stub(bot, 'login');
      await bot.start();
      await bot.messageProcessingVerifier.scheduleVerification(
        makeTestMessage({
          id: '123',
          user: { id: '456', bot: false, username: '' },
          channel: makeTestChannel({ type: 'guild' }),
          content: '!foo',
        })
      );
      expect(bot.messageProcessingVerifier.scheduledVerificationsCount).to.eq(1);
      await bot.destroy();
      expect(bot.messageProcessingVerifier.scheduledVerificationsCount).to.eq(0);
    });
  });
});
