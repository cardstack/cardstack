/* eslint-env node */
const moment = require('moment-timezone');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

function priorityRelationship(id) {
  return ['priority', {
    id,
    type: 'priorities'
  }];
}

function threadRelationship(id) {
  return ['thread', {
    id,
    type: 'threads'
  }];
}

function initialModels() {
  let initial = new JSONAPIFactory();

  initial.addResource('content-types', 'priorities')
    .withRelated('fields', [
      initial.addResource('fields', 'value').withAttributes({
        fieldType: '@cardstack/core-types::integer'
      }),
      initial.addResource('fields', 'name').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
    ]);

  initial.addResource('content-types', 'threads')
    .withRelated('fields', [
      initial.addResource('fields', 'messages').withAttributes({
        fieldType: '@cardstack/core-types::has-many'
      }),
    ]);

  initial.addResource('content-types', 'messages')
    .withRelated('fields', [
      initial.addResource('fields', 'text').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      initial.addResource('fields', 'status').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      initial.addResource('fields', 'tag').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      initial.addResource('fields', 'is-handled').withAttributes({
        fieldType: '@cardstack/core-types::boolean'
      }),
      initial.addResource('fields', 'updated-at').withAttributes({
        fieldType: '@cardstack/core-types::date'
      }),
      initial.addResource('fields', 'priority').withAttributes({
        fieldType: '@cardstack/core-types::belongs-to'
      }),
      initial.addResource('fields', 'thread').withAttributes({
        fieldType: '@cardstack/core-types::belongs-to'
      }),
      // Imitating a polymorphic relationship
      initial.addResource('fields', 'card-id').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      initial.addResource('fields', 'card-type').withAttributes({
        fieldType: '@cardstack/core-types::string'
      })
    ]);

  initial.addResource('content-types', 'chat-messages')
    .withRelated('fields', [
      initial.addResource('fields', 'text').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
    ]);

  initial.addResource('content-types', 'songs')
    .withRelated('fields', [
      initial.addResource('fields', 'title').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      initial.addResource('fields', 'artist').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      initial.addResource('fields', 'comment').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      initial.addResource('fields', 'url').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
    ]);

  initial.addResource('content-types', 'song-change-requests')
    .withRelated('fields', [
      initial.addResource('fields', 'text').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      initial.addResource('fields', 'song').withAttributes({
        fieldType: '@cardstack/core-types::belongs-to'
      }),
    ]);

  initial.addResource('content-types', 'song-license-requests')
    .withRelated('fields', [
      initial.addResource('fields', 'comment').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      initial.addResource('fields', 'song').withAttributes({
        fieldType: '@cardstack/core-types::belongs-to'
      }),
    ]);

  initial.addResource('threads', '1');
  initial.addResource('threads', '2');
  initial.addResource('threads', '3');
  initial.addResource('threads', '4');

  initial.addResource('priorities', 'delegated')
    .withAttributes({
      value: 0,
      name: 'Delegated'
    });

  initial.addResource('priorities', 'need-response')
    .withAttributes({
      value: 10,
      name: 'Need Response'
    });

  initial.addResource('priorities', 'processed')
    .withAttributes({
      value: 20,
      name: 'Processed'
    });

  initial.addResource('priorities', 'fyi')
    .withAttributes({
      value: 30,
      name: 'For Your Information'
    });

  initial.addResource('song-change-requests', '1')
    .withAttributes({
      text: "Could we change our previous cover of Pearl Jam's Daughter?",
    });

  initial.addResource('chat-messages', '1')
    .withAttributes({
      text: "Is that also your favorite Pearl Jam song?",
    });

  initial.addResource('songs', '1')
    .withAttributes({
      artist: "Pearl Jam",
      title: "Daughter - Live",
      comment: "Totally. This live version is amazing.",
      url: 'https://youtu.be/pearl-jam/daughter'
    });

  initial.addResource('songs', '2')
    .withAttributes({
      artist: "Tool",
      title: "46 & 2",
      comment: "That's the album version.",
      url: 'https://youtu.be/tool/46-and-2'
    });

  initial.addResource('song-license-requests', '1')
    .withAttributes({
      comment: "We'd like to ask for a license for our cover of Tool's 46 & 2.",
    });

  initial.addResource('chat-messages', '2')
    .withAttributes({
      text: "This is going to be though, my friend.",
    });

  initial.addResource('song-license-requests', '2')
    .withAttributes({
      comment: 'License request for Chris Cornell\'s Seasons approved',
    });

  initial.addResource('song-change-requests', '2')
    .withAttributes({
      comment: 'Could we add yet more guitars to this Caspian song?',
    });

  // Messages
  initial.addResource('messages', '1')
    .withAttributes({
      status: 'pending',
      tag: 'Song Change Request',
      //TODO: Rename to sentAt
      updatedAt: moment().subtract(moment.duration(2, 'days')),
      cardId: '1',
      cardType: 'song-change-requests'
    })
    .withRelated(...priorityRelationship('need-response'))
    .withRelated(...threadRelationship('1'))

  initial.addResource('messages', '2')
    .withAttributes({
      // status: 'pending',
      // tag: 'Request to publish live',
      updatedAt: moment().subtract(moment.duration(1, 'day')),
      cardId: '1',
      cardType: 'chat-messages'
    })
    // .withRelated(...priorityRelationship('need-response'))
    .withRelated(...threadRelationship('1'))

  initial.addResource('messages', '3')
    .withAttributes({
      // status: 'pending',
      // tag: 'Ready for copyediting',
      updatedAt: moment(),
      cardId: '1',
      cardType: 'songs'
    })
    // .withRelated(...priorityRelationship('need-response'))
    .withRelated(...threadRelationship('1'));

  initial.addResource('messages', '4')
    .withAttributes({
      status: 'pending',
      tag: 'License Request',
      updatedAt: moment().subtract(moment.duration(1, 'week')),
      cardId: '1',
      cardType: 'song-license-requests'
    })
    .withRelated(...priorityRelationship('need-response'))
    .withRelated(...threadRelationship('2'));

  initial.addResource('messages', '5')
    .withAttributes({
      updatedAt: moment().subtract(moment.duration(4, 'days')),
      cardId: '2',
      cardType: 'songs',
    })
    .withRelated(...threadRelationship('2'));

  initial.addResource('messages', '6')
    .withAttributes({
      updatedAt: moment().subtract(moment.duration(2, 'days')),
      cardId: '2',
      cardType: 'chat-messages'
    })
    .withRelated(...threadRelationship('2'));

  initial.addResource('messages', '7')
    .withAttributes({
      status: 'approved',
      tag: 'License Request',
      updatedAt: moment(),
      cardId: '2',
      cardType: 'song-license-requests'
    })
    .withRelated(...priorityRelationship('fyi'))
    .withRelated(...threadRelationship('3'));

  initial.addResource('messages', '8')
    .withAttributes({
      status: 'pending',
      tag: 'Song Change Request',
      updatedAt: moment().subtract(moment.duration(1, 'day')),
      cardId: '2',
      cardType: 'song-change-requests'
    })
    .withRelated(...priorityRelationship('delegated'))
    .withRelated(...threadRelationship('4'));

  return initial.getModels();
}

module.exports = [
  {
    type: 'plugin-configs',
    id: '@cardstack/hub',
    relationships: {
      'default-data-source': {
        data: { type: 'data-sources', id: 0 }
      }
    }
  },
  {
    type: 'plugin-configs',
    id: '@cardstack/ephemeral',
  },
  {
    type: 'plugin-configs',
    id: '@cardstack/jsonapi',
  },
  {
    type: 'data-sources',
    id: 0,
    attributes: {
      'source-type': '@cardstack/ephemeral',
      params: {
        initialModels: initialModels()
      }
    }
  },
  {
    type: 'grants',
    id: 0,
    attributes: {
      'may-create-resource': true,
      'may-update-resource': true,
      'may-delete-resource': true,
      'may-write-field': true
    }
  }
];
