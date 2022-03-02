const { join } = require('path');

module.exports = {
  db: {
    url: 'postgres://postgres:postgres@localhost:5432/hub_test',
    useTransactionalRollbacks: true,
  },
  serverSecret: '2Lhrsi7xSDMv1agfW+hghvQkdkTRSqW/JGApSjLT0NA=',
  checkly: {
    handleWebhookRequests: true,
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
