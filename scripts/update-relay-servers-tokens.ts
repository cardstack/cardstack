/* eslint-disable node/no-unsupported-features/es-syntax */
/* eslint-disable node/no-unpublished-import  */
/* eslint-disable node/no-missing-import */

import { RelayAdmin, Token, PriceOracleTicker } from './relay/relay-admin.js';
import { readFileSync } from 'fs';

if (process.argv.length < 6) {
  console.error(
    'usage: yarn update-relay-tokens [tokenlist.json] [host] [username] [password]\n' +
      'example: yarn update-relay-tokens ../packages/cardpay-sdk/token-lists/goerli-tokenlist.json https://relay-goerli.staging.stack.cards user123 password123'
  );
  throw 'not enough arguments';
}

const TOKEN_LIST_JSON_FILE_PATH = process.argv[2];
const RELAY_ADMIN_HOST = process.argv[3];
const RELAY_ADMIN_USERNAME = process.argv[4];
const RELAY_ADMIN_PASSWORD = process.argv[5];
const DRY_RUN = process.env.DRY_RUN && process.env.DRY_RUN !== 'false';

interface TokenListJsonToken {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI: string;
  tags: string[];
}

async function main() {
  try {
    const username = RELAY_ADMIN_USERNAME;
    const password = RELAY_ADMIN_PASSWORD;

    const client = new RelayAdmin(RELAY_ADMIN_HOST);
    await client.login(username, password);

    const tokenlistFile = readFileSync(TOKEN_LIST_JSON_FILE_PATH, 'utf8');
    const tokenlist = JSON.parse(tokenlistFile);

    let tokens = await client.getTokens();
    let tokensToAdd: Token[] = [];
    tokenlist.tokens
      .filter((token: TokenListJsonToken) => token.tags.includes('relayGas'))
      .filter((token: TokenListJsonToken) => !tokens.find((t) => t.symbol === token.symbol))
      .forEach((token: TokenListJsonToken) => {
        tokensToAdd.push({
          address: token.address,
          name: token.name,
          symbol: token.symbol,
          decimals: token.decimals,
          logoUri: token.logoURI,
          gas: token.tags.includes('relayGas'),
          relevance: 100,
        });
      });

    for (const token of tokensToAdd) {
      if (!DRY_RUN) {
        await client.addToken(token);
      } else {
        console.log(`token to be added: ${token.symbol}`);
      }
    }

    tokens = await client.getTokens();

    let oracles = await client.getPriceOracles();
    const uniswapv3 = oracles.find((oracle) => oracle.name == 'uniswapv3');
    if (uniswapv3 === undefined) {
      throw 'uniswapv3 oracle not found';
    }

    let tickers = await client.getPriceOracleTickers();
    let tickersToAdd: PriceOracleTicker[] = [];
    tokens
      .filter((token) => !tickers.find((ticker) => ticker.token.symbol === token.symbol))
      .forEach((token) => {
        tickersToAdd.push({
          token,
          priceOracle: uniswapv3,
          ticker: token.address,
          inverse: false,
        });
      });

    for (const ticker of tickersToAdd) {
      if (!DRY_RUN) {
        await client.addPriceOracleTicker(ticker);
      } else {
        console.log(`ticker to be added: ${ticker.token.symbol}`);
      }
    }

    tickers = await client.getPriceOracleTickers();
    const tickersMissingPrice = tickers.filter((ticker) => !ticker.price).map((ticker) => ticker.token.symbol);
    if (tickersMissingPrice.length > 0) {
      console.log('Following tickers are unable to compute the price(s):\n' + tickersMissingPrice.join('\n'));
    }
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }
}

main();
