import { Argv } from 'yargs';
import { getSDK, getConstant, getConstantByNetwork } from '@cardstack/cardpay-sdk';
import { waitUntilOneBlockAfterTxnMined } from '@cardstack/cardpay-sdk';
import { NETWORK_OPTION_LAYER_2, getEthereumClients, getConnectionType, Web3Opts, Web3OptsMnemonic } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { encodeDID } from '@cardstack/did-resolver';
import Web3 from 'web3';
const { toChecksumAddress } = Web3.utils;
import { generateMnemonic } from 'bip39';

export default {
  command: 'create-account <createPrepaidCardSafe> <createMerchantSafe> <createRewardSafe>',
  describe: 'Create an account from scratch',
  builder(yargs: Argv) {
    return yargs
      .positional('createPrepaidCardSafe', {
        type: 'boolean',
        description: '',
      })
      .positional('createMerchantSafe', {
        type: 'boolean',
        description: '',
      })
      .positional('createRewardSafe', {
        type: 'boolean',
        description: '',
      })
      .options({
        network: NETWORK_OPTION_LAYER_2,
      });
  },
  async handler(args: Arguments) {
    let { network, createPrepaidCardSafe, createMerchantSafe, createRewardSafe } = args as unknown as {
      network: string;
      createPrepaidCardSafe: boolean;
      createMerchantSafe: boolean;
      createRewardSafe: boolean;
    };

    if (createRewardSafe && !createPrepaidCardSafe) {
      throw new Error('Cannot register rewardee without prepaid card');
    }
    if (createMerchantSafe && !createPrepaidCardSafe) {
      throw new Error('Cannot register merchant without prepaid card');
    }

    const createdMnemonic = generateMnemonic();

    const web3Opts = getConnectionType(args);
    const createdWeb3Opts: Web3OptsMnemonic = {
      connectionType: 'mnemonic',
      mnemonic: createdMnemonic,
    };
    const { web3: createdWeb3 } = await getEthereumClients(network, createdWeb3Opts);

    const createdOwner = (await createdWeb3.eth.getAccounts())[0];

    const prepaidCardAddress = createPrepaidCardSafe
      ? await provisionPrepaidCard(createdOwner, network, web3Opts)
      : undefined;
    const merchantSafeAddress =
      prepaidCardAddress && createMerchantSafe
        ? await registerMerchant(prepaidCardAddress, network, createdWeb3Opts)
        : undefined;
    const rewardSafeAddress =
      prepaidCardAddress && createRewardSafe
        ? await registerRewardee(prepaidCardAddress, network, createdWeb3Opts)
        : undefined;

    console.log(` 
      Mnemonic: ${createdMnemonic} (WARNING: This is not a secure mnemonic. Only intended for testing!)
      Address: ${createdOwner}
      Prepaid card: ${prepaidCardAddress ?? 'No prepaid card created'}
      Merchant safe: ${merchantSafeAddress ?? 'No merchant safe created'}
      Reward safe: ${rewardSafeAddress ?? 'No reward safe created'}
    `);
  },
} as CommandModule;

const provisionPrepaidCard = async (createdOwner: string, network: string, web3Opts: Web3Opts): Promise<string> => {
  console.log('Creating prepaid card');
  const { web3 } = await getEthereumClients(network, web3Opts);
  const provisionerSecret = process.env.PROVISIONER_SECRET;
  if (!provisionerSecret) {
    throw new Error('Provisioner secret not provided');
  }
  let environment: string;
  let sku: string;
  switch (network) {
    case 'gnosis':
      environment = 'production';
      sku = '';
      break;
    case 'sokol':
      environment = 'staging';
      sku = '0xbdd9b9de628f3c2ddf330021facbb43aeef0c8926c068f22800b2dd26c8eb377';
      break;

    default:
      throw new Error('Unrecognized network');
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
    throw new Error('');
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
  const { web3, signer } = await getEthereumClients(network, web3Opts);
  let revenuePool = await getSDK('RevenuePool', web3, signer);
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
  const rewardProgramId = '0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72';
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
  return rewardSafe;
};
