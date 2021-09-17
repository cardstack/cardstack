/* global __dirname, process, console */

import { writeJSONSync, writeFileSync, readFileSync, removeSync, existsSync, ensureDirSync } from 'fs-extra';
import { join, resolve } from 'path';
import { addFilePreamble } from './pre-tsc-build-entrypoint';

// This file runs before tsc compiles the rest of the mono repo so we need to
// get creative about how we load our data

const sourceAbiDir = resolve(join(__dirname, '..', '..', 'cardpay-sdk', 'contracts', 'abi', 'latest'));
const addressFile = resolve(join(__dirname, '..', '..', 'cardpay-sdk', 'contracts', 'addresses.ts'));
const abiDir = resolve(join(__dirname, '..', 'abis', 'generated'));
const subgraphTemplateFile = resolve(join(__dirname, '..', 'subgraph-template.yaml'));
const subgraphFile = resolve(join(__dirname, '..', 'subgraph.yaml'));
const generatedDir = join(__dirname, '..', 'src', 'generated');
const generatedAddresses = join(generatedDir, 'addresses.ts');

const network = process.argv.slice(2)[0];
if (!network) {
  console.error(`need to specify network`);
  process.exit(1);
}
let cleanNetwork = network.replace('poa-', '');

let cardpayGenesisBlock = {
  sokol: 21403252,
  xdai: 17265698,
};
let tokenStartBlock = {
  sokol: 20644808, // the block that the token bridge was created (and hence our CPXD tokens)
  xdai: cardpayGenesisBlock.xdai,
};
let gnosisSafeGenesisBlock = {
  sokol: cardpayGenesisBlock.sokol,
  xdai: cardpayGenesisBlock.xdai,
};
let uniswapV2GenesisBlock = {
  sokol: 21474163,
  xdai: cardpayGenesisBlock.xdai,
};

let v0_7_0_startBlock = {
  sokol: 22189483,
  // TODO populate this after the contract deployment for v0.7.0
  xdai: 0,
};

let v0_8_0_startBlock = {
  sokol: 22728770,
  // TODO populate this after the contract deployment for v0.8.0
  xdai: 0,
};

let abis = {
  PrepaidCardManager: getAbi(join(sourceAbiDir, 'prepaid-card-manager.ts')),
  PrepaidCardMarket: getAbi(join(sourceAbiDir, 'prepaid-card-market.ts')),
  RevenuePool: getAbi(join(sourceAbiDir, 'revenue-pool.ts')),
  Spend: getAbi(join(sourceAbiDir, 'spend.ts')),
  PayMerchantHandler: getAbi(join(sourceAbiDir, 'pay-merchant-handler.ts')),
  RegisterMerchantHandler: getAbi(join(sourceAbiDir, 'register-merchant-handler.ts')),
  SplitPrepaidCardHandler: getAbi(join(sourceAbiDir, 'split-prepaid-card-handler.ts')),
  TransferPrepaidCardHandler: getAbi(join(sourceAbiDir, 'transfer-prepaid-card-handler.ts')),
  MerchantManager: getAbi(join(sourceAbiDir, 'merchant-manager.ts')),
  SupplierManager: getAbi(join(sourceAbiDir, 'supplier-manager.ts')),
  Exchange: getAbi(join(sourceAbiDir, 'exchange.ts')),
  DeprecatedMerchantManager_v0_6_7: getAbi(join(sourceAbiDir, 'deprecated-merchant-manager-0_6_7.ts')),
};

removeSync(abiDir);
ensureDirSync(abiDir);
for (let [name, abi] of Object.entries(abis)) {
  if (!abi) {
    continue;
  }
  writeJSONSync(join(abiDir, `${name}.json`), abi, { spaces: 2 });
}

let subgraph = readFileSync(subgraphTemplateFile, { encoding: 'utf8' })
  .replace(/{NETWORK}/g, network)
  .replace(/{GNOSIS_SAFE_PROXY_FACTORY}/g, getAddress('gnosisProxyFactory', cleanNetwork))
  .replace(/{PREPAID_CARD_MANAGER_ADDRESS}/g, getAddress('prepaidCardManager', cleanNetwork))
  .replace(/{PREPAID_CARD_MARKET_ADDRESS}/g, getAddress('prepaidCardMarket', cleanNetwork))
  .replace(/{UNISWAP_V2_FACTORY_ADDRESS}/g, getAddress('uniswapV2Factory', cleanNetwork))
  .replace(/{HOME_TOKEN_BRIDGE_ADDRESS}/g, getAddress('homeBridge', cleanNetwork))
  .replace(/{REVENUE_POOL_ADDRESS}/g, getAddress('revenuePool', cleanNetwork))
  .replace(/{EXCHANGE_ADDRESS}/g, getAddress('exchange', cleanNetwork))
  .replace(/{PAY_MERCHANT_HANDLER_ADDRESS}/g, getAddress('payMerchantHandler', cleanNetwork))
  .replace(/{REGISTER_MERCHANT_HANDLER_ADDRESS}/g, getAddress('registerMerchantHandler', cleanNetwork))
  .replace(/{SPLIT_PREPAID_CARD_HANDLER_ADDRESS}/g, getAddress('splitPrepaidCardHandler', cleanNetwork))
  .replace(/{TRANSFER_PREPAID_CARD_HANDLER_ADDRESS}/g, getAddress('transferPrepaidCardHandler', cleanNetwork))
  .replace(/{MERCHANT_MANAGER_ADDRESS}/g, getAddress('merchantManager', cleanNetwork))
  .replace(/{SUPPLIER_MANAGER_ADDRESS}/g, getAddress('supplierManager', cleanNetwork))
  .replace(/{SPEND_ADDRESS}/g, getAddress('spend', cleanNetwork))
  .replace(/{DAI_CPXD_ADDRESS}/g, getAddress('daiCpxd', cleanNetwork))
  .replace(/{CARD_CPXD_ADDRESS}/g, getAddress('cardCpxd', cleanNetwork))
  .replace(/{CARDPAY_GENESIS_BLOCK}/g, cardpayGenesisBlock[cleanNetwork])
  .replace(/{SAFE_GENESIS_BLOCK}/g, gnosisSafeGenesisBlock[cleanNetwork])
  .replace(/{UNISWAP_V2_GENESIS_BLOCK}/g, uniswapV2GenesisBlock[cleanNetwork])
  .replace(/{TOKEN_START_BLOCK}/g, tokenStartBlock[cleanNetwork])
  .replace(/{v0_7_0_START_BLOCK}/g, v0_7_0_startBlock[cleanNetwork])
  .replace(/{v0_8_0_START_BLOCK}/g, v0_8_0_startBlock[cleanNetwork])
  .replace(
    /{DEPRECATED_MERCHANT_MANAGER_v0_6_7_ADDRESS}/g,
    getAddress('deprecatedMerchantManager_v0_6_7', cleanNetwork)
  );

removeSync(subgraphFile);
writeFileSync(subgraphFile, subgraph);
ensureDirSync(generatedDir);
writeFileSync(
  generatedAddresses,
  `
/* This is an auto generated file, please do not edit this file */

export let addresses = new Map<string, string>();
addresses.set("prepaidCardManager", "${getAddress('prepaidCardManager', cleanNetwork)}");
`
);

addFilePreamble(
  subgraphFile,
  `### This is an auto generated file, please do not edit this file ###
### network: ${cleanNetwork}
`
);

function getAbi(path) {
  if (!existsSync(path)) {
    return;
  }
  let file = readFileSync(path, { encoding: 'utf8' })
    .replace(/^export default /, '')
    .replace(/;$/, '');
  return eval(file);
}

function getAddress(contractName, network) {
  let file = readFileSync(addressFile, { encoding: 'utf8' });
  let [, networkContents] = file.match(new RegExp(`${network.toUpperCase()} = {([^}]*)}`));
  let [, address] = networkContents.match(new RegExp(`${contractName}: ['"](\\w*)['"]`));
  return address;
}
