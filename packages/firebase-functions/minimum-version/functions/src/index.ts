import { https } from 'firebase-functions';

const MIN_VERSION = '1.1.1';

exports.minimumVersion = https.onRequest(async (_, res) => {
  res.status(200).send(JSON.stringify({ minVersion: MIN_VERSION }));
});
