/* eslint-env node */
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

function initialModels() {
  let factory = new JSONAPIFactory();
  factory.addResource('data-sources', 'mock-auth')
    .withAttributes({
      sourceType: '@cardstack/mock-auth',
      params: {
        users: {
          user1: {
            name: "Hassan Abdel-Rahman",
            email: "hassan.abdelrahman@gmail.com",
            picture: "https://lh3.googleusercontent.com/-U2m6pPQ7vKY/AAAAAAAAAAI/AAAAAAAAAc0/z6Y4IOekEcU/photo.jpg",
            verified: true
          }
        }
      }
    });

  factory.addResource('grants')
    .withRelated('who', { type: 'groups', id: 'everyone' })
    .withAttributes({
      mayLogin: true
    });
  return factory.getModels();
}

module.exports = initialModels();
