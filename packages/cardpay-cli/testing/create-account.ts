/*global fetch */
import { Argv } from 'yargs';
import { getSDK, getConstant, getConstantByNetwork, getAddress } from '@cardstack/cardpay-sdk';
import { waitUntilOneBlockAfterTxnMined } from '@cardstack/cardpay-sdk';
import { NETWORK_OPTION_LAYER_1, getEthereumClients, getConnectionType, Web3Opts } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { encodeDID } from '@cardstack/did-resolver';
import Web3 from 'web3';
const { toChecksumAddress, toWei } = Web3.utils;
import { generateMnemonic } from 'bip39';

export default {
  command: 'create-account <createPrepaidCardSafe> <createMerchantSafe> <createRewardSafe> <createDepotSafe>',
  describe: 'Create an account from scratch',
  builder(yargs: Argv) {
    return yargs
      .positional('createPrepaidCardSafe', {
        type: 'boolean',
        description: 'create a prepaid card',
      })
      .positional('createMerchantSafe', {
        type: 'boolean',
        description: 'create a merchant safe',
      })
      .positional('createRewardSafe', {
        type: 'boolean',
        description: 'create a reward safe',
      })
      .positional('createDepotSafe', {
        type: 'boolean',
        description: 'create a depot safe',
      })
      .option('bridgeTokenAmount', {
        type: 'string',
        description: 'amount to bridge',
      })
      .option('bridgeTokenAddress', {
        type: 'string',
        description: 'l1 token address to bridge',
      })
      .options({
        network: NETWORK_OPTION_LAYER_1,
      });
  },
  async handler(args: Arguments) {
    let {
      network: networkL1,
      createPrepaidCardSafe,
      createMerchantSafe,
      createRewardSafe,
      createDepotSafe,
      bridgeTokenAmount,
      bridgeTokenAddress,
    } = args as unknown as {
      network: string;
      createPrepaidCardSafe: boolean;
      createMerchantSafe: boolean;
      createRewardSafe: boolean;
      createDepotSafe: boolean;
      bridgeTokenAmount?: string;
      bridgeTokenAddress?: string;
    };

    if (createRewardSafe && !createPrepaidCardSafe) {
      throw new Error('Cannot register rewardee without prepaid card');
    }
    if (createMerchantSafe && !createPrepaidCardSafe) {
      throw new Error('Cannot register merchant without prepaid card');
    }
    if ((bridgeTokenAmount && !createDepotSafe) || (bridgeTokenAddress && !createDepotSafe)) {
      throw new Error('Cannot provide optional arguments when depot safe not being created');
    }

    const createdMnemonic = generateMnemonic();

    const web3OptsL1 = getConnectionType(args);
    const createdWeb3OptsL2: Web3OptsMnemonic = {
      connectionType: 'mnemonic',
      mnemonic: createdMnemonic,
    };
    const networkL2 = (L2_NETWORK_BY_L1 as any)[networkL1];
    if (!networkL2) {
      throw new Error(`No corresponding l2 network found of l1 network ${networkL1}`);
    }
    const { web3: createdWeb3L2 } = await getEthereumClients(networkL2, createdWeb3OptsL2);

    const createdOwner = (await createdWeb3L2.eth.getAccounts())[0];

    const prepaidCardAddress = createPrepaidCardSafe
      ? await provisionPrepaidCard(createdOwner, networkL2, createdWeb3OptsL2)
      : undefined;
    const merchantSafeAddress =
      prepaidCardAddress && createMerchantSafe
        ? await registerMerchant(prepaidCardAddress, networkL2, createdWeb3OptsL2)
        : undefined;
    const rewardSafeAddress =
      prepaidCardAddress && createRewardSafe
        ? await registerRewardee(prepaidCardAddress, networkL2, createdWeb3OptsL2)
        : undefined;

    const depotAddress = createDepotSafe
      ? await bridgeToken(
          createdOwner,
          networkL1,
          web3OptsL1,
          networkL2,
          createdWeb3OptsL2,
          bridgeTokenAddress,
          bridgeTokenAmount
        )
      : undefined;

    console.log(`

  WARNING: NOT A SECURE MNEMONIC. ONLY INTENDED FOR TESTING!

      Mnemonic: ${createdMnemonic} 
      Address: ${createdOwner}
      Prepaid card: ${prepaidCardAddress ?? 'No prepaid card created'}
      Merchant safe: ${merchantSafeAddress ?? 'No merchant safe created'}
      Reward safe: ${rewardSafeAddress ?? 'No reward safe created'}
      Depot safe: ${depotAddress ?? 'No depot safe created'}
    `);
  },
} as CommandModule;

const provisionPrepaidCard = async (createdOwner: string, network: string, web3Opts: Web3Opts): Promise<string> => {
  console.log('Creating prepaid card');
  const { web3 } = await getEthereumClients(network, web3Opts);
  const provisionerSecret = process.env.PROVISIONER_SECRET;
  const sku: string = (L2_NETWORK_CONFIG as any)[network].sku;
  const environment: string = (L2_NETWORK_CONFIG as any)[network].environment;
  if (!provisionerSecret) {
    throw new Error('PROVISIONER_SECRET env not provided');
  }
  if (!sku) {
    throw new Error('Default sku does not exist');
  }
  if (!environment) {
    throw new Error('Default environment does not exist');
  }
  let prepaidCardMarketV2 = await getSDK('PrepaidCardMarketV2', web3);
  const prepaidCardMgr = await getSDK('PrepaidCard', web3);
  let blockExplorer = await getConstant('blockExplorer', web3);

  console.log(
    `Provisioning a prepaid card from the SKU ${sku} to the EOA ${createdOwner} in the ${environment} environment...`
  );

  let quantity = await prepaidCardMarketV2.getQuantity(sku);

  if (quantity === 0) {
    throw new Error(`There is not enough balance in the issuer safe to provision a card of SKU ${sku}`);
  }

  let relayUrl = getConstantByNetwork('relayServiceURL', network);
  let response = await fetch(`${relayUrl}/v2/prepaid-card/provision/${sku}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: provisionerSecret,
    },
    body: JSON.stringify({
      owner: toChecksumAddress(createdOwner),
    }),
  });

  let body = await response.json();
  if (!response.ok) {
    console.log(
      `Could not provision prepaid card for customer ${createdOwner}, sku ${sku}, received ${
        response.status
      } from relay server: ${JSON.stringify(body)}`
    );
    throw new Error('Provisioning of prepaid card failed');
  }
  let { txHash } = body;
  console.log(`Transaction hash: ${blockExplorer}/tx/${txHash}/token-transfers`);
  await waitUntilOneBlockAfterTxnMined(web3, txHash);

  let [prepaidCard] = await prepaidCardMgr.getPrepaidCardsFromTxn(txHash);
  console.log(`Provisioned the EOA ${createdOwner} the prepaid card ${prepaidCard}`);
  return prepaidCard;
};

const registerMerchant = async (prepaidCard: string, network: string, web3Opts: Web3Opts) => {
  console.log('Registering merchant account');
  const { web3 } = await getEthereumClients(network, web3Opts);
  let revenuePool = await getSDK('RevenuePool', web3);
  let blockExplorer = await getConstant('blockExplorer', web3);
  let merchantDID = encodeDID({ type: 'MerchantInfo' });
  let { merchantSafe } =
    (await revenuePool.registerMerchant(prepaidCard, merchantDID, {
      onTxnHash: (txnHash) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
    })) ?? {};
  console.log(`Created merchant safe: ${merchantSafe.address}`);
  return merchantSafe.address;
};

const registerRewardee = async (prepaidCard: string, network: string, web3Opts: Web3Opts) => {
  console.log('Registering rewardee');
  const rewardProgramId: string = (L2_NETWORK_CONFIG as any)[network].rewardProgramId;
  if (!rewardProgramId) {
    throw new Error(`No reward program id recognised for network ${network}`);
  }
  let { web3 } = await getEthereumClients(network, web3Opts);
  const prepaidCardMgr = await getSDK('PrepaidCard', web3);
  const owner = await prepaidCardMgr.getPrepaidCardOwner(prepaidCard);
  let rewardManagerAPI = await getSDK('RewardManager', web3);
  let blockExplorer = await getConstant('blockExplorer', web3);
  let { rewardSafe } = await rewardManagerAPI.registerRewardee(
    prepaidCard,
    rewardProgramId,
    {
      onTxnHash: (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
    },
    { from: owner }
  );
  console.log(`Registered rewardee: ${owner} with reward safe ${rewardSafe}`);
  return rewardSafe;
};

const bridgeToken = async (
  receiver: string,
  networkL1: string,
  web3OptsL1: Web3Opts,
  networkL2: string,
  web3OptsL2: Web3Opts,
  bridgeTokenAddress: string | undefined,
  amount: string | undefined
) => {
  let { web3: web3L1 } = await getEthereumClients(networkL1, web3OptsL1);
  let { web3: web3L2 } = await getEthereumClients(networkL2, web3OptsL2);
  let blockExplorer = await getConstant('blockExplorer', web3L1);
  let tokenBridgeForeginSide = await getSDK('TokenBridgeForeignSide', web3L1);
  let tokenBridgeHomeSide = await getSDK('TokenBridgeHomeSide', web3L2);
  let tokenAddress = bridgeTokenAddress ?? (await getAddress('daiToken', web3L1));
  const amountInWei = toWei(amount ?? '10');
  await tokenBridgeForeginSide.unlockTokens(tokenAddress, amountInWei, {
    onTxnHash: (txnHash) => console.log(`Approve transaction hash: ${blockExplorer}/tx/${txnHash}`),
  });
  const blockNumber = await web3L2.eth.getBlockNumber();
  await tokenBridgeForeginSide.relayTokens(tokenAddress, receiver, amountInWei, {
    onTxnHash: (txnHash) => console.log(`Relay tokens transaction hash: ${blockExplorer}/tx/${txnHash}`),
  });
  await tokenBridgeHomeSide.waitForBridgingToLayer2Completed(receiver, blockNumber.toString());
  let safesApi = await getSDK('Safes', web3L2);
  let safes = (await safesApi.view(receiver, { type: 'depot' })).safes.filter((safe) => safe.type !== 'external');
  if (safes.length == 0) {
    throw new Error(`No depot safes for ${receiver}`);
  }
  return safes[0].address;
};

const L2_NETWORK_BY_L1 = {
  kovan: 'sokol',
  mainnet: 'gnosis',
};
const L2_NETWORK_CONFIG = {
  sokol: {
    sku: '0xbdd9b9de628f3c2ddf330021facbb43aeef0c8926c068f22800b2dd26c8eb377',
    rewardProgramId: '0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72',
    environment: 'staging',
  },
  gnosis: {
    sku: '',
    rewardProgramId: '0x979C9F171fb6e9BC501Aa7eEd71ca8dC27cF1185',
    environment: 'production',
  },
};
