import { Argv } from 'yargs';
import { getResolver } from '@cardstack/did-resolver';
import { Resolver } from 'did-resolver';
import { Arguments, CommandModule } from 'yargs';

export default {
  command: 'resolve <did>',
  describe: 'Decode the DID to a JSON DIDResult',
  builder(yargs: Argv) {
    return yargs.positional('did', {
      type: 'string',
      description: 'The DID to decode',
    });
  },
  async handler(args: Arguments) {
    let { did } = args as unknown as {
      did: string;
    };
    let didResolver = new Resolver(getResolver());
    let didResult = await didResolver.resolve(did);
    console.log(JSON.stringify(didResult, undefined, 2));
  },
} as CommandModule;
