import type { Argv } from 'yargs';
import createSafe from './create-safe';
import enableModule from './enable-module';
import details from './details';
import execute from './execute';
import addValidator from './add-validator';
import registerAccount from './register-account';
import sign from './sign';
import setDid from './set-did';
import getConfiguration from './get-configuration';
import summary from './summary';
import isModuleEnabled from './is-module-enabled';
import isRegistered from './is-registered';
import removeValidator from './remove-validator';

export const command = 'claim-settlement <command>';
export const desc = 'Commands to interact with the claim settlement module';

export const builder = function (yargs: Argv) {
  return yargs.command([
    createSafe,
    enableModule,
    details,
    execute,
    addValidator,
    registerAccount,
    sign,
    setDid,
    getConfiguration,
    summary,
    isModuleEnabled,
    isRegistered,
    removeValidator,
  ] as any);
};

export function handler(/* argv: Argv */) {
  throw new Error('You must specify a valid subcommand');
}
