import fetch from 'node-fetch';

// @ts-ignore polyfilling fetch
global.fetch = fetch;

const USAGE = `node sync-status <green | blue>`;
const nodes: { [node: string]: string } = {
  'sokol-green': 'https://graph-staging-green.stack.cards/subgraphs/name/habdelra/cardpay-sokol',
  'sokol-blue': 'https://graph-staging-blue.stack.cards/subgraphs/name/habdelra/cardpay-sokol',
  'xdai-green': 'https://graph-production-green.cardstack.com/subgraphs/name/habdelra/cardpay-xdai',
  'xdai-blue': 'https://graph-production-blue.cardstack.com/subgraphs/name/habdelra/cardpay-xdai',
};

let node = process.argv[2];
if (!node) {
  console.error(`please specify the node to query
${USAGE}`);
  process.exit(1);
}

(async () => {
  let status = await syncQuery(node);
  if (status == null) {
    console.log(`The ${node} node has not started syncing`);
  } else {
    console.log(
      `The ${node} node has synced to block number ${status.blockHeight} and has ${
        status.hasIndexingErrors ? 'encountered' : 'no'
      } indexing errors`
    );
  }
  process.exit(0);
})().catch((err) => console.error(err));

async function syncQuery(node: string): Promise<{ blockHeight: number; hasIndexingErrors: boolean } | undefined> {
  let subgraphURL = nodes[node];
  if (!subgraphURL) {
    throw new Error(`invalid node: ${node}`);
  }
  let response = await fetch(subgraphURL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      query: `
      {
        _meta {
          hasIndexingErrors
          block {
            number
          }
        }
      }`,
      variables: {},
    }),
  });

  let meta = (await response.json()).data?._meta;
  let hasIndexingErrors = meta?.hasIndexingErrors;
  let blockHeight = meta?.block?.number;
  if (hasIndexingErrors != null && blockHeight != null) {
    return { hasIndexingErrors, blockHeight };
  }
  return;
}
