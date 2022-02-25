import { Argv } from 'yargs';
import { getResolver } from '@cardstack/did-resolver';
import { Resolver } from 'did-resolver';
import { Arguments, CommandModule } from 'yargs';
import fetch from 'node-fetch';

export default {
  command: 'resolve-aka <did>',
  describe: 'Decode the DID to a JSON DIDResult and output the contents of the alsoKnownAs URL',
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
    if (!didResult.didDocument?.alsoKnownAs) {
      throw new Error('No alsoKnownAs found for DID');
    }
    let urlResponse = await fetch(didResult.didDocument?.alsoKnownAs[0]);
    let content = await urlResponse.json();
    console.log(JSON.stringify(content, null, 1));
  },
} as CommandModule;
