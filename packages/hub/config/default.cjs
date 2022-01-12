module.exports = {
  hubEnvironment: 'development',
  healthCheckPort: 3000,
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
    botId: '896093538297708564',
    botToken: null,
    cordeBotId: '898595095195029595',
    cordeBotToken: null,
    commandPrefix: '!',
    allowedGuilds: '896093062562983986',
    allowedChannels: '896093062562983989,898891181575000074',
    messageVerificationDelayMs: 1000 * 15,
  },
  serverSecret: null,
  sentry: {
    dsn: null,
    enabled: false,
    environment: null,
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
