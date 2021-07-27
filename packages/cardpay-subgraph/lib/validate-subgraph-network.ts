import { readFileSync } from 'fs-extra';
import { join, resolve } from 'path';

const subgraphFile = resolve(join(__dirname, '..', 'subgraph.yaml'));
const network = process.argv.slice(2)[0];
if (!network) {
  console.error(`need to specify network`);
  process.exit(1);
}

let fileContents = readFileSync(subgraphFile, 'utf8');
let networkRegEx = new RegExp(`### network: ${network}`);
if (fileContents.match(networkRegEx)) {
  process.exit(0);
} else {
  console.error(`network ${network} not found in ${subgraphFile}`);
  process.exit(1);
}
