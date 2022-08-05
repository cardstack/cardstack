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
      serviceAccount: {
        client_email: 'test@example.com',
        private_key: `THIS IS FAKE

-----BEGIN RSA PRIVATE KEY-----
MIIBOgIBAAJBAOTUaxf5R6ctqGE7+VWfmmGHpcaONeP5EgIiKFFMgiQ5PzA+i8xI
DDKl6YhPC4hx5WST98uae9F5RopsFQ9uBsUCAwEAAQJAei96Z7ixq/DTQeg2QKQS
WRWHTThOSkaKeR0oDhEeRJxSR/+IJO5+pvKxw8XEioSW+UkzZ1Xar0bQ9vgQqi3x
gQIhAPOi/07ewCGKhqSAajAJKqANuS9MGW3YlsU6eWbF8GYVAiEA8HERpYHmaD1G
sfhurg0LmCqunx4RCfR8BvvA0h3mefECIQCSFp2iLDzmn8qmXv3NOeHeQPxWmPny
fNnC/5IGBxBkFQIgGC1mdtwPDSBMQY0XpAzPw6dXE8z0LaoV5qXeB8LV8CECIGmi
04tL7zRgmzzrRK4LoXLwBTufCeFjlPcoP5TQsdFC
-----END RSA PRIVATE KEY-----`,
      },
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
  relay: {
    provisionerSecret: 'fakesecret',
  },
};
