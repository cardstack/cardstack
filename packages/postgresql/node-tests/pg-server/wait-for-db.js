/* eslint-disable no-console */
const { Client } = require('pg');

const started = Date.now();

async function main() {
  while (true) {
    try {
      let pgClient = new Client({ database: 'postgres', host: 'localhost', user: 'postgres' });
      await pgClient.connect();
      await pgClient.query(`select 1+1`);
      return;
    } catch (err) {
      if (started + 30000 < Date.now()) {
        console.log("Giving up on postgresql");
        process.exit(-1);
      }
      console.log("Waiting for postgresql to start");
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

main().then(() => process.exit(0), err => { console.log(err); process.exit(-1); });
