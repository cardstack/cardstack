import HubDiscordBotsDbGateway from '../../../services/discord-bots/discord-bots-db-gateway';
import shortUuid, { SUUID } from 'short-uuid';
import DatabaseManager from '@cardstack/db';
import { Snowflake } from '@cardstack/discord-bot/types';
import { SnowflakeUtil } from '@cardstack/discord-bot';
import { createContainer } from '../../../main';
import type { Container } from '@cardstack/di';

describe('HubDiscordBotsDatabaseGateway', function () {
  let subject: HubDiscordBotsDbGateway, dbManager: DatabaseManager, botId: SUUID, container: Container;
  beforeEach(async function () {
    container = createContainer();
    subject = await container.lookup('hub-discord-bots-db-gateway');
    dbManager = await container.lookup('database-manager');
    botId = shortUuid.generate();
  });
  afterEach(async function () {
    await container.teardown();
  });

  describe('updateStatus', function () {
    it('adds a database row if none present', async function () {
      let client = await dbManager.getClient();
      await client.query(`DELETE FROM discord_bots`);
      await subject.updateStatus('connecting', 'test-bot', botId);
      let rows = (await client.query('SELECT * FROM discord_bots')).rows;
      expect(rows.length).to.equal(1);
      expect(rows[0].bot_id).to.equal(botId);
      expect(rows[0].bot_type).to.equal('test-bot');
      expect(rows[0].status).to.equal('connecting');
      expect(rows[0].last_message_id).to.be.null;
    });

    it('updates the database row if already present', async function () {
      let client = await dbManager.getClient();
      await client.query(`DELETE FROM discord_bots`);
      await subject.updateStatus('connecting', 'test-bot', botId);
      await subject.updateStatus('connected', 'test-bot', botId);
      let rows = (await client.query('SELECT * FROM discord_bots')).rows;
      expect(rows.length).to.equal(1);
      expect(rows[0].bot_id).to.equal(botId);
      expect(rows[0].bot_type).to.equal('test-bot');
      expect(rows[0].status).to.equal('connected');
      expect(rows[0].last_message_id).to.be.null;
    });
  });

  describe('becomeListener', function () {
    describe('when no other bot of the same type has status of listening', function () {
      beforeEach(async function () {
        await subject.updateStatus('disconnected', 'test-bot', shortUuid.generate());
        await subject.updateStatus('connected', 'test-bot', shortUuid.generate());
        await subject.updateStatus('connected', 'test-bot', botId);
      });
      it('updates a bot record to listening status', async function () {
        let client = await dbManager.getClient();
        await subject.becomeListener(botId, 'test-bot');
        let rows = (await client.query('SELECT * FROM discord_bots WHERE bot_id = $1', [botId])).rows;
        expect(rows.length).to.equal(1);
        expect(rows[0].bot_id).to.equal(botId);
        expect(rows[0].bot_type).to.equal('test-bot');
        expect(rows[0].status).to.equal('listening');
      });
    });
    describe('when another bot of the same type has already has a status of listening', function () {
      beforeEach(async function () {
        await subject.updateStatus('disconnected', 'test-bot', shortUuid.generate());
        await subject.updateStatus('listening', 'test-bot', shortUuid.generate());
        await subject.updateStatus('connected', 'test-bot', botId);
      });
      it('does nothing', async function () {
        let client = await dbManager.getClient();
        await subject.becomeListener(botId, 'test-bot');
        let rows = (await client.query('SELECT * FROM discord_bots WHERE bot_id = $1', [botId])).rows;
        expect(rows.length).to.equal(1);
        expect(rows[0].bot_id).to.equal(botId);
        expect(rows[0].bot_type).to.equal('test-bot');
        expect(rows[0].status).to.equal('connected');
      });
    });
    describe('when called with a previousListenerId argument', function () {
      let previousListenerId: SUUID;
      beforeEach(async function () {
        await subject.updateStatus('connected', 'test-bot', botId);
      });
      describe('when the listening bot has the previousListenerId', function () {
        beforeEach(async function () {
          previousListenerId = shortUuid.generate();
          await subject.updateStatus('listening', 'test-bot', previousListenerId);
        });
        it('makes the requesting bot the listener', async function () {
          await subject.becomeListener(botId, 'test-bot', previousListenerId);
          let client = await dbManager.getClient();
          let rows = (await client.query('SELECT * FROM discord_bots WHERE bot_id = $1', [botId])).rows;
          expect(rows.length).to.equal(1);
          expect(rows[0].bot_id).to.equal(botId);
          expect(rows[0].bot_type).to.equal('test-bot');
          expect(rows[0].status).to.equal('listening');
          // assert that the previous bot is "disconnected"
          rows = (await client.query('SELECT * FROM discord_bots WHERE bot_id = $1', [previousListenerId])).rows;
          expect(rows.length).to.equal(1);
          expect(rows[0].bot_id).to.equal(previousListenerId);
          expect(rows[0].bot_type).to.equal('test-bot');
          expect(rows[0].status).to.equal('disconnected');
        });
      });
      describe('when the listening bot has a different id', function () {
        let otherBotId: SUUID;
        beforeEach(async function () {
          otherBotId = shortUuid.generate();
          previousListenerId = shortUuid.generate();
          await subject.updateStatus('listening', 'test-bot', otherBotId);
        });
        it('does not make the requesting bot the listener', async function () {
          await subject.becomeListener(botId, 'test-bot', previousListenerId);
          let client = await dbManager.getClient();
          let rows = (await client.query('SELECT * FROM discord_bots WHERE bot_id = $1', [botId])).rows;
          expect(rows.length).to.equal(1);
          expect(rows[0].bot_id).to.equal(botId);
          expect(rows[0].bot_type).to.equal('test-bot');
          expect(rows[0].status).to.equal('connected');
          rows = (await client.query('SELECT * FROM discord_bots WHERE bot_id = $1', [otherBotId])).rows;
          expect(rows.length).to.equal(1);
          expect(rows[0].bot_id).to.equal(otherBotId);
          expect(rows[0].bot_type).to.equal('test-bot');
          expect(rows[0].status).to.equal('listening');
        });
      });
    });
  });

  describe('updateLastMessageProcessed', async function () {
    beforeEach(async function () {
      await subject.updateStatus('listening', 'test-bot', botId);
    });
    it('updated the last_message_id column', async function () {
      let client = await dbManager.getClient();
      let messageId = SnowflakeUtil.generate();
      await subject.updateLastMessageProcessed(messageId, botId);
      let rows = (await client.query('SELECT * FROM discord_bots WHERE bot_id = $1', [botId])).rows;
      expect(rows[0].last_message_id).to.equal(messageId);
    });
  });

  describe('getLastMessageIdProcessed', async function () {
    let messageId: Snowflake;
    beforeEach(async function () {
      let otherBotId = shortUuid.generate();
      await subject.updateStatus('listening', 'test-bot', otherBotId);
      await subject.updateLastMessageProcessed(SnowflakeUtil.generate(), otherBotId);
      await subject.updateStatus('disconnected', 'test-bot', otherBotId);
      await subject.updateStatus('listening', 'test-bot', botId);
      messageId = SnowflakeUtil.generate();
      await subject.updateLastMessageProcessed(messageId, botId);
    });
    it('fetches the last_message_id column for the listen', async function () {
      let lastMessageId = await subject.getLastMessageIdProcessed('test-bot');
      expect(lastMessageId).to.equal(messageId);
    });
  });

  describe('getCurrentListenerId', async function () {
    it('returns the bot_id of the listener for the specified type', async function () {
      await subject.updateStatus('listening', 'other', shortUuid.generate());
      let listenerId = await subject.getCurrentListenerId('test-bot');
      expect(listenerId).to.be.undefined;
      await subject.updateStatus('listening', 'test-bot', botId);
      listenerId = await subject.getCurrentListenerId('test-bot');
      expect(listenerId).to.be.eq(botId);
    });
  });

  describe('tests that are incompatible with transactional rollbacks', function () {
    let originalDbConfig: any;
    beforeEach(async function () {
      originalDbConfig = dbManager.dbConfig;
      let newDbConfig = Object.assign({}, originalDbConfig);
      newDbConfig.useTransactionalRollbacks = false;
      dbManager.dbConfig = newDbConfig;
    });
    afterEach(async function () {
      let client = await dbManager.getClient();
      client.query('DELETE FROM discord_bots');
      dbManager.dbConfig = originalDbConfig;
    });

    describe('subscribe', async function () {
      let testBotId: SUUID, otherBotId: SUUID;
      beforeEach(async function () {
        testBotId = shortUuid.generate();
        otherBotId = shortUuid.generate();
        await subject.updateStatus('listening', 'test-bot', testBotId);
        await subject.updateStatus('listening', 'other-bot', otherBotId);
      });
      describe('discord_bot_status channel', function () {
        it('notifies when a bot moves from listening status to disconnected status', async function () {
          let timesCalled = 0;
          let calledWithBotType: string | undefined;
          await subject.subscribe('discord_bot_status', 'test-bot', (payload: any) => {
            timesCalled++;
            calledWithBotType = payload.bot_type;
          });
          await subject.updateStatus('disconnected', 'test-bot', testBotId);
          await subject.updateStatus('disconnected', 'other-bot', otherBotId);
          await subject.updateStatus('connected', 'new-bot', shortUuid.generate());
          await new Promise((resolve) => setTimeout(resolve, 100));
          expect(timesCalled).to.equal(1, 'callback should be called once');
          expect(calledWithBotType).to.equal('test-bot');
        });
      });
      describe('discord_bot_message_processing channel', function () {
        it('notifies when the last_message_id is updated', async function () {
          let timesCalled = 0;
          let calledWithBotType: string | undefined;
          let calledWithLastMessageId: Snowflake | undefined;
          await subject.subscribe('discord_bot_message_processing', 'test-bot', (payload: any) => {
            timesCalled++;
            calledWithBotType = payload.bot_type;
            calledWithLastMessageId = payload.id;
          });
          let messageId = SnowflakeUtil.generate();
          await subject.updateLastMessageProcessed(messageId, testBotId);
          await subject.updateLastMessageProcessed(SnowflakeUtil.generate(), otherBotId);
          expect(timesCalled).to.equal(1);
          expect(calledWithBotType).to.equal('test-bot');
          expect(calledWithLastMessageId).to.equal(messageId);
        });
      });
    });

    describe('unsubscribe', async function () {
      let testBotId: SUUID, otherBotId: SUUID;
      beforeEach(async function () {
        testBotId = shortUuid.generate();
        otherBotId = shortUuid.generate();
        await subject.updateStatus('listening', 'test-bot', testBotId);
        await subject.updateStatus('listening', 'other-bot', otherBotId);
      });
      describe('discord_bot_status channel', function () {
        it('notifies when a bot moves from listening status to disconnected status', async function () {
          let timesCalled = 0;
          await subject.subscribe('discord_bot_status', 'test-bot', (_payload) => {
            timesCalled++;
          });
          await subject.unsubscribe('discord_bot_status', 'test-bot');
          await subject.updateStatus('disconnected', 'test-bot', testBotId);
          await new Promise((resolve) => setTimeout(resolve, 100));
          expect(timesCalled).to.equal(0, 'callback should not be called');
        });
      });
      describe('discord_bot_message_processing channel', function () {
        it('notifies when the last_message_id is updated', async function () {
          let timesCalled = 0;
          await subject.subscribe('discord_bot_message_processing', 'test-bot', (_payload) => {
            timesCalled++;
          });
          await subject.unsubscribe('discord_bot_message_processing', 'test-bot');
          let messageId = SnowflakeUtil.generate();
          await subject.updateLastMessageProcessed(messageId, testBotId);
          expect(timesCalled).to.equal(0);
        });
      });
    });
  });
});
