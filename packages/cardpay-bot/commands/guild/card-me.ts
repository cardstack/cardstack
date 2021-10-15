import { Command } from '../../bot';
import config from 'config';
import { BetaTestConfig } from '../../types';
import { sendDM, activateDMConversation, createDM } from '../../utils/dm';
import { isBetaTester } from '../../utils/guild';
import { getBetaTester, setBetaTester } from '../../utils/beta-tester';
import * as Sentry from '@sentry/node';
import logger from '@cardstack/logger';

const log = logger('command:card-me');
const { sku } = config.get('betaTesting') as BetaTestConfig;

export const name: Command['name'] = 'card-me';
export const description: Command['description'] = 'Airdrop Cardstack prepaid cards';
export const run: Command['run'] = async (bot, message) => {
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

  let db = await bot.databaseManager.getClient();
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
  await activateDMConversation(db, dm.id, member.id, 'airdrop-prepaidcard:start');
  await sendDM(
    message,
    member,
    dm,
    `Hi! I'll be sending a prepaid card to you. First you'll need to download the Card Wallet app from the app store and launch it. If you are viewing this message on the same device that you downloaded your Card Wallet to, then switch devices so that you can use your Card Wallet to scan a QR code in this chat. Type "ok" if you are ready to continue.`
  );
};
