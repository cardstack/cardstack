import { Command } from '@cardstack/discord-bot/bot';
import config from 'config';
import { sendDM, createDM } from '@cardstack/discord-bot/utils/dm';
import { getBetaTester, setBetaTester } from '../../utils/beta-tester';

import * as Sentry from '@sentry/node';
import logger from '@cardstack/logger';
import { BetaTestConfig } from '../../types';
import { assertHubBot, isBetaTester } from '../../utils';
import Client, { Message } from '@cardstack/discord-bot';

const log = logger('command:card-me');
const { sku } = config.get('betaTesting') as BetaTestConfig;

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

  if (!isBetaTester(guild, member)) {
    await sendDM(message, member, dm, `Sorry, I can only give prepaid cards to beta testers.`);
    return;
  }

  let db = await bot.getDatabaseClient();
  let betaTester = await getBetaTester(db, member.id);
  if (betaTester?.airdropTxnHash) {
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

  await setBetaTester(db, member.id, member.user.username);
  await bot.discordBotsDbGateway.activateDMConversation(dm.id, member.id, 'airdrop-prepaidcard:start');
  await sendDM(
    message,
    member,
    dm,
    `Hi,

Connect your Card Wallet app to receive your prepaid card.

If you do not have the Card Wallet app, download Card Wallet at cardstack.com/cardpay

If you are viewing this message on the same device that you downloaded your Card Wallet to, then switch devices so that you can use your Card Wallet to scan a QR code in this chat.

Type "ok" if you are ready to continue.`
  );
};
