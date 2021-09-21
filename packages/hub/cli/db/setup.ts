import util from 'util';
import childProcess from 'child_process';
const exec = util.promisify(childProcess.exec);
import { handler as seed } from './seed';
import { handler as dump } from './dump';
import { handler as initTestDB } from './init-test';
import { Argv } from 'yargs';

exports.command = 'setup';
exports.desc = 'Initialize your local database';

exports.builder = {};

exports.handler = async function (argv: Argv) {
  try {
    await exec('createdb hub_development');
  } catch (e) {
    // ok if this fails
  }
  await exec('yarn db:migrate up');
  await seed(argv);
  await dump(argv);
  await initTestDB(argv);
};
