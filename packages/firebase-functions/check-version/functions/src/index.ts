import compareVersions from 'compare-versions';
import { https } from 'firebase-functions';

const MIN_VERSION = '1.0.0';

exports.checkVersion = https.onRequest(async (req, res) => {
  if (!req.body.version) {
    res.status(400).send({ status: 'invalid_params', message: 'Missing version parameter' });
    return;
  }

  const isMinimumVersion = compareVersions.compare(req.body.version, MIN_VERSION, '>=');

  res.status(200).send({
    status: 'success',
    data: {
      value: isMinimumVersion,
    },
    message: null,
  });
});
