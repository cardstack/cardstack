import { getConstantByNetwork } from '@cardstack/cardpay-sdk';
import config from 'config';
import Bot, { Command, Message, MessageEmbed } from '@cardstack/discord-bot';
import logger from '@cardstack/logger';
import * as Sentry from '@sentry/node';
import { basename, join } from 'path';
import {
  getBetaTester,
  setBetaTester,
  setBetaTesterAddress,
  setBetaTesterAirdropPrepaidCard,
  setBetaTesterAirdropTxnHash,
} from '../../../utils/beta-tester';
import { BetaTestConfig, Web3Config } from '../../../types';
import { name as cardmeName } from '../../guild/card-drop';
import HubBot from '../../..';
import { assertHubBot } from '../../../utils';

const log = logger('command:airdrop-prepaidcard');
export const name: Command['name'] = 'airdrop-prepaidcard:start';
export const description: Command['description'] = 'Collect wallet information to airdrop a prepaid card - start';

const { sku } = config.get('betaTesting') as BetaTestConfig;
const { network } = config.get('web3') as Web3Config;
const continueCommands = [`ok`, `yes`, `y`, `sure`, `okay`, `fine`, `ready`, `i'm ready`, `i am ready`]; // some helpful suggestions from github co-pilot
const quitCommands = ['quit', 'cancel', 'no', 'nope', 'nah', 'nevermind', 'nvm', 'stop', 'exit'];

// For DM conversations that includes multiple user inputs we can break
// conversation apart into a state machine where each command module is a state,
// and you can transition to the next state based on user input via the
// `continueDMConversation`. In this case we just ended up with a single state
// so it's a bit hard to illustrate the intended approach. would imagine that
// all the commands modules for a conversation can be grouped within the
// conversation folder (like this one).

export const run: Command['run'] = async (bot: Bot, message: Message, args: string[] = []) => {
  let [channelId] = args;
  if (!channelId || !message) {
    return;
  }
  let db = await bot.getDatabaseClient();
  if (quitCommands.includes(message.content.toLowerCase())) {
    bot.dmChannelsDbGateway.deactivateDMConversation(channelId, message.author.id);
    await message.reply(`ok, if you change your mind type \`!${cardmeName}\` in the public channel.`);
    return;
  }

  if (!continueCommands.includes(message.content.toLowerCase())) {
    await message.reply(`I didn't catch that--are you ready to continue?`);
    return;
  }

  let userId = message.author.id;
  try {
    let betaTester = await getBetaTester(db, userId);
    let address: string;
    if (!betaTester?.address) {
      let web3 = await (bot as HubBot).walletConnect.getWeb3(message);

      if (!web3) {
        await message.reply(
          'Uh Oh! Something went wrong. Please contact an admin to get help is getting a prepaid card'
        );
        return;
      }
      address = (await web3.eth.getAccounts())[0];
    } else {
      address = betaTester.address;
    }

    await setBetaTester(db, userId, message.author.username);
    Sentry.addBreadcrumb({ message: `captured user address for prepaid card airdrop ${address} of sku ${sku}` });
    await setBetaTesterAddress(db, userId, address);
    if (!(await checkInventory(message, bot))) {
      return;
    }

    await message.reply(`Great! I see your wallet address is ${address}. I'm sending you a prepaid card, hang on...`);
    let txnHash: string | undefined;
    try {
      assertHubBot(bot);
      txnHash = await bot.relay.provisionPrepaidCard(address, sku);
      Sentry.addBreadcrumb({ message: `obtained txnHash for prepaid card airdrop to ${address}: ${txnHash}` });
      await setBetaTesterAirdropTxnHash(db, userId, txnHash);

      let explorer = getConstantByNetwork('blockExplorer', network);
      await message.reply(
        `Your prepaid card is on the way, here is the transaction that includes your prepaid card ${explorer}tx/${txnHash}/token-transfers`
      );

      let web3 = await bot.web3.getInstance();
      let marketAPI = await bot.cardpay.getSDK('PrepaidCardMarket', web3);
      let prepaidCard = await marketAPI.getPrepaidCardFromProvisionTxnHash(txnHash);
      Sentry.addBreadcrumb({
        message: `obtained prepaid card address for prepaid card airdrop to ${address}: ${prepaidCard.address}`,
      });
      await setBetaTesterAirdropPrepaidCard(db, userId, prepaidCard.address);

      let prepaidCardImage = join(__dirname, '..', '..', '..', 'assets', 'prepaid-cards', `${sku}.png`);
      let embed = new MessageEmbed()
        .setTitle('Your Prepaid Card is Ready!')
        .setDescription(
          `Your prepaid card address is ${prepaidCard.address}. You can refresh your Card Wallet app to see your new prepaid card.`
        )
        .attachFiles([prepaidCardImage])
        .setImage(`attachment://${basename(prepaidCardImage)}`);
      await message.reply(embed);
    } catch (e) {
      log.error(
        `Error provisioning prepaid card of sku ${sku} to customer ${address}${
          txnHash ? ' with txnHash ' + txnHash : ''
        }`,
        e
      );
      Sentry.withScope(function () {
        Sentry.captureException(e);
      });
      await message.reply('Uh Oh! Something went wrong. Please contact an admin to get help is getting a prepaid card');
    }
  } finally {
    await bot.dmChannelsDbGateway.deactivateDMConversation(channelId, message.author.id);
  }
};

async function checkInventory(message: Message, bot: Bot): Promise<boolean> {
  assertHubBot(bot);
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
    await message.reply(
      `Sorry, it looks like we don't have any prepaid cards available right now, try asking me again in the future.`
    );
    return false;
  }
  return true;
}
