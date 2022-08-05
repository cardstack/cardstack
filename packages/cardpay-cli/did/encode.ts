import { encodeDID, EncodeOptions } from '@cardstack/did-resolver';
import { Arguments, Argv, CommandModule } from 'yargs';

export default {
  command: 'encode <type> [version] [uniqueId]',
  describe: 'Encode DID',
  builder(yargs: Argv) {
    return yargs
      .positional('type', {
        type: 'string',
        description: 'type',
      })
      .option('version', {
        type: 'string',
        description: 'version',
      })
      .option('uniqueId', {
        type: 'string',
        description: 'uniqueId',
      });
  },
  async handler(args: Arguments) {
    let { type, version, uniqueId } = args as unknown as {
      type: string;
      version: number;
      uniqueId: string;
    };
    let did = encodeDID({ type, version, uniqueId } as EncodeOptions);
    console.log(did);
  },
} as CommandModule;
