/* eslint-env node */
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

module.exports = [
  {
    type: 'plugin-configs',
    id: '@cardstack/ephemeral'
  },
  {
    type: 'data-sources',
    id: 'default',
    attributes: {
      'source-type': '@cardstack/ephemeral',
      params: {
        initialModels: initialModels()
      }
    }
  },
  {
    type: 'plugin-configs',
    id: '@cardstack/hub',
    relationships: {
      'default-data-source': {
        data: { type: 'data-sources', id: 'default' }
      }
    }
  }
];

function initialModels() {
  let factory = new JSONAPIFactory();
  factory.addResource('message-sinks', 'user-notification').withAttributes({
    messengerType: '@cardstack/notification',
    params: {
      socketIoUrl: "http://localhost:3100"
    }
  });
  factory.addResource('data-sources', 'mock-auth')
    .withAttributes({
      sourceType: '@cardstack/mock-auth',
      params: {
        users: {
          user1: {
            name: "Hassan Abdel-Rahman",
            email: "hassan.abdelrahman@gmail.com",
            picture: "https://lh3.googleusercontent.com/-U2m6pPQ7vKY/AAAAAAAAAAI/AAAAAAAAAc0/z6Y4IOekEcU/photo.jpg",
          }
        }
      }
    });
  return factory.getModels()
}
