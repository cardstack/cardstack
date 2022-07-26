import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { CURRENT_VERSION, encodeDID, EncodeOptions } from '@cardstack/did-resolver';
import shortUuid from 'short-uuid';
import { v5 as uuidv5 } from 'uuid';
import { Arguments, Argv, CommandModule } from 'yargs';
import { getConnectionType, getEthereumClients, NETWORK_OPTION_LAYER_2 } from '../../utils';

interface OffChainStorage {
  bucketName: string;
  region: string;
}
type OffChainInfo = Record<string, OffChainStorage>;
const offChainStorageConfig: OffChainInfo = {
  gnosis: {
    bucketName: 'storage.cardstack.com',
    region: 'ap-southeast-1',
  },
  sokol: {
    bucketName: 'tall-data-dev',
    region: 'us-east-1',
  },
};
const NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341';
export default {
  command: 'add-rule <fundingCard> <rewardProgramId> <blob>',
  describe: 'Add a rule to a reward program',
  builder(yargs: Argv) {
    return yargs
      .positional('fundingCard', {
        type: 'string',
        description: 'The prepaid card used to pay for gas for the txn',
      })
      .positional('rewardProgramId', {
        type: 'string',
        description: 'The reward program id.',
      })
      .positional('blob', {
        type: 'string',
        description: 'Hex encoding of rule blob',
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, fundingCard, rewardProgramId, blob } = args as unknown as {
      network: string;
      fundingCard: string;
      rewardProgramId: string;
      blob: string;
    };
    const s3Client = new S3Client({ region: offChainStorageConfig[network].region });
    let ruleJsonStr = Buffer.from(blob.slice(2), 'hex').toString('utf-8');
    let uid = uuidv5(ruleJsonStr, NAMESPACE);
    let did = encodeDID({ version: CURRENT_VERSION, type: 'RewardRule', uniqueId: uid } as EncodeOptions);
    console.log(`did = ${did}`);
    let { web3, signer } = await getEthereumClients(network, getConnectionType(args));
    let rewardManagerAPI = await getSDK('RewardManager', web3, signer);
    let blockExplorer = await getConstant('blockExplorer', web3);
    await rewardManagerAPI.addRewardRule(fundingCard, rewardProgramId, blob, {
      onTxnHash: (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
    });
    console.log(`Updated reward rule of reward program ${rewardProgramId} to ${blob}`);
    let bucketName = 'storage.cardstack.com';
    let shortUid = shortUuid().fromUUID(uid);
    let key = `reward-rule/${shortUid}.json`;
    await writeJsonToOffchainStorage(s3Client, bucketName, ruleJsonStr, key);
  },
} as CommandModule;

const writeJsonToOffchainStorage = async (s3Client: S3Client, jsonStr: string, bucketName: string, key: string) => {
  const res = await checkObjExists(s3Client, bucketName, key);
  if (!res) {
    await putJSONObj(s3Client, bucketName, key, jsonStr);
    console.log(`Wrote json to ${bucketName}/${key} `);
  } else {
    throw new Error(`${bucketName}/${key} already exists`);
  }
};
const checkObjExists = async (s3Client: S3Client, bucketName: string, key: string) => {
  let command = new HeadObjectCommand({
    Bucket: bucketName,
    Key: key,
  });
  let res = await s3Client.send(command);
  if (res['$metadata']['httpStatusCode'] != undefined && res['$metadata']['httpStatusCode'] == 200) {
    return true;
  } else {
    return false;
  }
};
const putJSONObj = async (s3Client: S3Client, bucketName: string, key: string, stringifiedJSON: string) => {
  let command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: stringifiedJSON,
    ContentType: 'application/json; charset=utf-8',
  });
  let res = await s3Client.send(command);
  if (res['$metadata']['httpStatusCode'] != undefined && res['$metadata']['httpStatusCode'] == 200) {
    console.log('JSON file written succesfully');
  } else {
    throw new Error(`JSON file was not written to ${bucketName}\\${key}`);
  }
};
