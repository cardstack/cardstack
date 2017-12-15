/* eslint-env node */
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

module.exports = [
  {
    type: 'plugin-configs',
    id: '@cardstack/ephemeral'
  },
  {
    type: 'data-sources',
    id: 'mock-auth',
    attributes: {
      'source-type': '@cardstack/mock-auth',
      params: {
        users: {
          user1:{
            name: "Hassan Abdel-Rahman",
            email: "hassan.abdelrahman@gmail.com",
            picture: "https://lh3.googleusercontent.com/-U2m6pPQ7vKY/AAAAAAAAAAI/AAAAAAAAAc0/z6Y4IOekEcU/photo.jpg",
          }
        }
      }
    }
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
  },
      {
        type: 'content-types',
        id: 'mock-users',
        attributes: {
        },
        relationships: {
          'fields': { data: [
            { type: 'fields', id: 'name' },
            { type: 'fields', id: 'email' },
            { type: 'fields', id: 'avatar-url' }
          ] }
        }
      },
      {
        type: 'fields',
        id: 'name',
        attributes: {
          'field-type': '@cardstack/core-types::string'
        }
      },
      {
        type: 'fields',
        id: 'email',
        attributes: {
          'field-type': '@cardstack/core-types::string'
        }
      },
      {
        type: 'fields',
        id: 'avatar-url',
        attributes: {
          'field-type': '@cardstack/core-types::string'
        }
      },
];

function initialModels() {
  let factory = new JSONAPIFactory();
  factory.addResource('message-sinks', 'socket-notification').withAttributes({
    messengerType: '@cardstack/notification',
    params: {
      // These properties are optional, the defaults are shown below
      // internalSocketIoPort: "3100",
      // internalSocketIoPath: "/",
      // socketIoUrl: "http://localhost:3100"

      // This sends a user notification event every 10 seconds to test the notification plugin
      notificationTest: {
        userType: "mock-users",
        userId: "user1",
        messageType: "message",
        intervalSec: 10
      }
    }
  });
  factory.addResource('content-types', 'messages')
    .withRelated('fields', [
      factory.addResource('fields', 'message').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      factory.addResource('fields', 'user').withAttributes({
        fieldType: '@cardstack/core-types::belongs-to'
      }).withRelated('related-types', [
        { type: 'content-types', id: 'mock-users' }
      ]),
    ]);

  return factory.getModels()
}
