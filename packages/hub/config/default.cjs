module.exports = {
  hubEnvironment: 'development',
  aws: {
    config: {
      credentials: {
        AccessKeyId: null,
        SecretAccessKey: null,
      },
      region: 'us-east-1',
    },
    offchainStorage: {
      bucketName: 'storage.cardstack.com',
      region: 'ap-southeast-1',
      roleChain: ['prod:storage-bucket-writer-role'],
    },
    accountId: '680542703984',
    prodAccountId: '120317779495',
  },
  db: {
    url: 'postgres://postgres:postgres@localhost:5432/hub_development',
    'migrations-dir': 'db/migrations',
    'migration-filename-format': 'utc',
    'ignore-pattern': 'README.md|.*\\.d\\.ts',
    'check-order': false,
  },
  discord: {
    botId: '958127663577456714',
    botToken: null,
    cordeBotId: '898595095195029595',
    cordeBotToken: null,
    commandPrefix: '!',
    allowedGuilds: '958136276559753266',
    allowedChannels: '958136277096620084,958137087641661450',
    messageVerificationDelayMs: 1000 * 15,
  },
  authSecret: null,
  sentry: {
    dsn: null,
    enabled: false,
    environment: null,
  },
  checkly: {
    handleWebhookRequests: false,
  },
  firebase: {
    projectId: null,
    clientEmail: null,
    privateKey: null,
    databaseURL: null,
  },
  wyre: {
    accountId: null,
    apiKey: null,
    secretKey: null,
    callbackUrl: null,
    url: 'https://api.testwyre.com',
  },
  exchangeRates: {
    allowedDomains: ['https://wallet-staging.stack.cards', 'https://wallet.cardstack.com'],
    apiKey: null,
  },
  relay: {
    provisionerSecret: null,
  },
  web3: {
    network: 'sokol',
  },
  cardDrop: {
    sku: '0x5e0d8bbe3c8e4d9013509b469dabfa029270b38a5c55c9c94c095ec6199d7fda',
  },
  walletConnect: {
    bridge: 'https://safe-walletconnect.gnosis.io/',
    clientURL: 'https://app.cardstack.com',
    clientName: 'Cardstack',
  },
  web3storage: {
    token: null,
  },
  statuspage: {
    apiKey: null,
    pageId: null,
  },
};
