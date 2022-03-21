import { Command } from '@cardstack/discord-bot/bot';
import config from 'config';
import { sendDM, createDM } from '@cardstack/discord-bot/utils/dm';
import { getCardDropRecipient, setCardDropRecipient } from '../../utils/card-drop';

import * as Sentry from '@sentry/node';
import logger from '@cardstack/logger';
import { CardDropConfig } from '../../types';
import { assertHubBot } from '../../utils';
import Client, { Message } from '@cardstack/discord-bot';

const log = logger('command:card-me');
const { sku } = config.get('cardDrop') as CardDropConfig;

export const name: Command['name'] = 'card-drop';
export const description: Command['description'] = 'Airdrop Cardstack prepaid cards';
export const run: Command['run'] = async (bot: Client, message: Message) => {
  assertHubBot(bot);
  let member = message.member;
  let guild = message.guild;
  if (!member || !guild) {
    return;
  }
  let dm = await createDM(message);

  let db = await bot.getDatabaseClient();
  let cardDropRecipient = await getCardDropRecipient(db, member.id);
  if (cardDropRecipient?.airdropTxnHash) {
    await sendDM(
      message,
      member,
      dm,
      `You have already been provisioned a prepaid card. If you are having problems accessing it contact an admin for help.`
    );
    return;
  }

  Sentry.addBreadcrumb({ message: `starting DM for ${name} command with ${member.id} (${member.user.username})` });

  let skuSummaries = await bot.inventory.getSKUSummaries();
  let skuSummary = skuSummaries.find((summary) => summary.id === sku);
  let quantity = skuSummary?.attributes?.quantity;
  if (quantity == null || quantity === 0) {
    let errMessage =
      quantity == null
        ? `prepaid card airdrop sku does not exist ${sku}`
        : `prepaid card airdrop sku ${sku} has no inventory`;
    Sentry.addBreadcrumb({ message: errMessage });
    log.error(errMessage);
    await sendDM(
      message,
      member,
      dm,
      `Sorry, it looks like we don't have any prepaid cards available right now, try asking me again in the future.`
    );
    return;
  }

  Sentry.addBreadcrumb({ message: `sku quantity for sku ${sku} is ${quantity}` });

  await setCardDropRecipient(db, member.id, member.user.username);
  await bot.discordBotsDbGateway.activateDMConversation(dm.id, member.id, 'airdrop-prepaidcard:start');
  await sendDM(
    message,
    member,
    dm,
    `Hi,

To claim a prepaid card you’ll need Card Wallet app to receive your prepaid card.

If you do not have the Card Wallet app, download Card Wallet at https://cardstack.com/ios or https://cardstack.com/android

Type "ok" if you are ready to continue.`
  );
};

export const aliases = [];
