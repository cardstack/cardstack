import fetch from 'node-fetch';

// @ts-ignore polyfilling fetch
global.fetch = fetch;

let subgraphUrl = process.argv[2];
if (!subgraphUrl) {
  console.error(`Specify the subgraph url.`);
  process.exit(1);
}

(async () => {
  let response = await fetch(subgraphUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      query: `
      {
        _meta {
          deployment
        }
      }`,
    }),
  });

  let meta = (await response.json()).data?._meta;
  let deploymentId = meta?.deployment;
  console.log(deploymentId);
  process.exit(0);
})().catch((err) => console.error(err));
