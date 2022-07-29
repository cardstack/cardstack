import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { CURRENT_VERSION, encodeDID, EncodeOptions, UUIDV5_NAMESPACE } from '@cardstack/did-resolver';
import * as fs from 'fs';
import { join } from 'path';
import shortUuid from 'short-uuid';
import { v5 as uuidv5 } from 'uuid';
import { Arguments, Argv, CommandModule } from 'yargs';
import { getConnectionType, getEthereumClients, NETWORK_OPTION_LAYER_2 } from '../../utils';

export default {
  command: 'add-rule <fundingCard> <rewardProgramId> <pathToJsonRule>',
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
      .positional('pathToJsonRule', {
        type: 'string',
        default: 'rule.json',
        description:
          'Relative path to json rule. The file should exist in cardpay-cli/rewards/admin. The default is rule.json',
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, fundingCard, rewardProgramId, pathToJsonRule } = args as unknown as {
      network: string;
      fundingCard: string;
      rewardProgramId: string;
      pathToJsonRule: string;
    };
    const s3Client = new S3Client({ region: 'ap-southeast-1' });
    let ruleJsonStr = JSON.stringify(readJsonFile(pathToJsonRule));
    let uid = uuidv5(ruleJsonStr, UUIDV5_NAMESPACE);
    let did = encodeDID({ version: CURRENT_VERSION, type: 'RewardRule', uniqueId: uid } as EncodeOptions);
    console.log(`The did of the reward rule  = ${did}`);
    let didBlob = hexEncode(did);
    let bucketName = 'storage.cardstack.com';
    let shortUid = shortUuid().fromUUID(uid);
    let key = `reward-rule/${shortUid}.json`;
    await writeJsonToOffchainStorage(s3Client, ruleJsonStr, bucketName, key);
    let { web3, signer } = await getEthereumClients(network, getConnectionType(args));
    let rewardManagerAPI = await getSDK('RewardManager', web3, signer);
    let blockExplorer = await getConstant('blockExplorer', web3);
    await rewardManagerAPI.addRewardRule(fundingCard, rewardProgramId, didBlob, {
      onTxnHash: (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
    });
    console.log(`Updated reward rule of reward program ${rewardProgramId} to ${didBlob}`);
  },
} as CommandModule;

const hexEncode = (data: string) => {
  return '0x' + Buffer.from(data, 'utf-8').toString('hex');
};

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
  try {
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
  } catch (e) {
    console.log(e instanceof Error ? e.message : JSON.stringify(e));
    if (e instanceof Error) {
      if (e.message == 'UnknownError') {
        return false;
      }
    }
    throw e;
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

const readJsonFile = (filePath: string) => {
  return JSON.parse(fs.readFileSync(join(__dirname, filePath), 'utf-8'));
};
