import util from 'util';
import childProcess from 'child_process';
const exec = util.promisify(childProcess.exec);
import config from 'config';
import { Argv } from 'yargs';

export let command = 'init-test';
export let describe = 'Create the test database using the ENVs config';
export let builder = {};

export async function handler(_argv: Argv) {
  const dbConfig = config.get<any>('db');
  let dbUrl = dbConfig.url as string;
  let dbName = dbUrl.split('/').reverse()[0];
  if (!process.env.CI) {
    try {
      console.log(`Dropping ${dbName} db...`);
      let result = await exec(`dropdb ${dbName}`);
      console.log(result);
    } catch (e) {
      // ok if this fails
    }
    console.log(`Creating new ${dbName} db...`);
    let result = await exec(`createdb ${dbName}`);
    console.log(result);
  }

  console.log(`Loading structure.sql into new ${dbName} db...`);
  let result = await exec(`psql ${dbConfig.url} < config/structure.sql`);
  console.log(result);
}
