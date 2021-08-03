import { https, Request } from 'firebase-functions';
import { initializeApp, credential } from 'firebase-admin';
import { push } from './routes/push';
import { register } from './routes/register';
import cors from 'cors';
import { IResponse } from './types';

const serviceAccount = require('./service-account.json') || {};

const adminConfig = process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG) : undefined;
adminConfig.credential = credential.cert(serviceAccount as any);
initializeApp(adminConfig);

exports.push = https.onRequest(async (req: Request, res) => {
  cors({ origin: true })(req, res, () => {});

  if (req.method.toUpperCase() === 'OPTIONS') {
    return;
  }

  let response: IResponse = {
    code: 404,
    success: false,
    errorMessage: 'Error: Operation not supported',
  };

  if (req.method.toUpperCase() === 'POST') {
    switch (req.params[0]) {
      // To test locally replace "" with "/"
      case '':
        response = await push(req);
        break;
      // To test locally replace "new" with "/new"
      case 'new':
        response = await register(req);
        break;
    }
  }

  res.status(response.code).send(response);
});
