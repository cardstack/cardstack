const { join } = require('path');

module.exports = {
  db: {
    url: 'postgres://postgres:postgres@localhost:5432/hub_test',
    useTransactionalRollbacks: true,
  },
  hubEnvironment: 'test',
  authSecret: '2Lhrsi7xSDMv1agfW+hghvQkdkTRSqW/JGApSjLT0NA=',
  cardDrop: {
    email: {
      rateLimit: {
        count: 100,
        periodMinutes: 10,
      },
    },
    verificationUrl: 'https://card-drop-email.test/email-card-drop/verify',
  },
  iap: {
    apple: {
      verificationUrl: 'https://buy.itunes.apple.test/verifyReceipt',
    },
    google: {
      verificationUrlBase:
        'https://www.googleapis.test/androidpublisher/v3/applications/com.cardstack.cardpay/purchases/products/0001/tokens',
    },
  },
  emailHashSalt: 'P91APjz3Ef6q3KAdOCfKa5hOcEmOyrPeRPG6+g380LY=',
  checkly: {
    handleWebhookRequests: true,
  },
  web3: {
    layer1Network: 'kovan',
    layer1RpcNodeHttpsUrl: 'https://infuratest.test/abc123/',
    layer1RpcNodeWssUrl: 'wss://infuratest.test/ws/abc123/',
    layer2Network: 'sokol',
    layer2RpcNodeHttpsUrl: 'https://humorme.test/abc123/',
    layer2RpcNodeWssUrl: 'wss://humorme.test/abc123/',
  },
  compiler: {
    realmsConfig: [
      {
        url: 'https://cardstack.com/base/',
        directory: join(__dirname, '..', '..', 'base-cards'),
        watch: false,
      },
      {
        url: 'https://demo.com/',
        directory: join(__dirname, '..', '..', 'demo-cards'),
        watch: false,
      },
    ],
  },
};
