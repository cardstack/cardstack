/* eslint-env node */
const moment = require('moment-timezone');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

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

  initial.addResource('content-types', 'tags')
    .withRelated('fields', [
      initial.addResource('fields', 'name').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
    ]);

  initial.addResource('content-types', 'threads')
    .withRelated('fields', [
      initial.addResource('fields', 'messages').withAttributes({
        fieldType: '@cardstack/core-types::has-many'
      })
      .withRelated('related-types', [
        { type: 'content-types', id: 'messages' }
      ]),
    ]);

  initial.addResource('content-types', 'messages')
    .withRelated('fields', [
      //TODO: `text` field should be removed
      initial.addResource('fields', 'text').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      initial.addResource('fields', 'status').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      //TODO: `is-handled` field should be removed
      initial.addResource('fields', 'is-handled').withAttributes({
        fieldType: '@cardstack/core-types::boolean'
      }),
      initial.addResource('fields', 'sent-at').withAttributes({
        fieldType: '@cardstack/core-types::date'
      }),
      // Imitating a polymorphic relationship
      initial.addResource('fields', 'card-id').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      initial.addResource('fields', 'card-type').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      initial.addResource('fields', 'priority').withAttributes({
        fieldType: '@cardstack/core-types::belongs-to'
      })
        .withRelated('related-types', [
          { type: 'content-types', id: 'priorities' }
        ]),
      initial.addResource('fields', 'tags').withAttributes({
        fieldType: '@cardstack/core-types::has-many'
      })
        .withRelated('related-types', [
          { type: 'content-types', id: 'tags' }
        ]),
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
      initial.addResource('fields', 'comment').withAttributes({
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

  // Seed tags
  let songChangeRequestTag = initial.addResource('tags')
    .withAttributes({
      name: 'Song Change Request'
    });

  let requestToPublishLiveTag = initial.addResource('tags')
    .withAttributes({
      name: 'Request to Publish Live'
    });

  let licenseRequestTag =  initial.addResource('tags')
    .withAttributes({
      name: 'License Request'
    });

  // Seed threads
  initial.addResource('threads', '1')
  .withRelated('messages', [
    { id: '1', type: 'messages' },
    { id: '2', type: 'messages' },
    { id: '3', type: 'messages' },
  ]);

  initial.addResource('threads', '2').withRelated('messages', [
    { id: '4', type: 'messages' },
    { id: '5', type: 'messages' },
    { id: '6', type: 'messages' },
  ]);

  initial.addResource('threads', '3').withRelated('messages', [
    { id: '7', type: 'messages' },
  ]);

  initial.addResource('threads', '4').withRelated('messages', [
    { id: '8', type: 'messages' },
  ]);

  initial.addResource('threads', '5').withRelated('messages', [
    { id: '9', type: 'messages' },
  ]);

  // Seed priorities
  let delegated = initial.addResource('priorities')
    .withAttributes({
      value: 0,
      name: 'Delegated'
    });

  let needResponse = initial.addResource('priorities')
    .withAttributes({
      value: 10,
      name: 'Need Response'
    });

  initial.addResource('priorities')
    .withAttributes({
      value: 20,
      name: 'Processed'
    });

  let fyi = initial.addResource('priorities')
    .withAttributes({
      value: 30,
      name: 'For Your Information'
    });

  // Seed song change requests
  initial.addResource('song-change-requests', '1')
    .withAttributes({
      comment: "Could we change our previous cover of Pearl Jam's Daughter?",
    });

  initial.addResource('song-change-requests', '2')
    .withAttributes({
      comment: 'Could we add yet more guitars to this Caspian song?',
    });

  // Seed chat messages
  initial.addResource('chat-messages', '1')
    .withAttributes({
      text: "Is that also your favorite Pearl Jam song?",
    });

  initial.addResource('chat-messages', '2')
    .withAttributes({
      text: "This is going to be tough, my friend.",
    });

  // Seed songs
  initial.addResource('songs', '1')
    .withAttributes({
      artist: "Pearl Jam",
      title: "Daughter - Live",
      comment: "Totally. This live version is amazing.",
      url: 'https://www.youtube.com/watch?v=IbhsAhSsMxM',
    });

  initial.addResource('songs', '2')
    .withAttributes({
      artist: "Tool",
      title: "46 & 2",
      comment: "That's the album version.",
      url: 'https://www.youtube.com/watch?v=NH0qYhAvtXk',
    });

  // Seed song license requests
  initial.addResource('song-license-requests', '1')
    .withAttributes({
      comment: "We'd like to ask for a license for our cover of Tool's 46 & 2.",
    });

  initial.addResource('song-license-requests', '2')
    .withAttributes({
      comment: 'License request for Chris Cornell\'s Seasons',
  });

  initial.addResource('song-license-requests', '3')
    .withAttributes({
      comment: 'License request for Caspian\'s Sycamore, please?',
    });

  // Seed messages
  initial.addResource('messages', '1')
    .withAttributes({
      status: 'unhandled',
      sentAt: moment().subtract(moment.duration(2, 'days')),
      cardId: '1',
      cardType: 'song-change-requests'
    })
    .withRelated('priority', needResponse)
    .withRelated('tags', [songChangeRequestTag]);

  initial.addResource('messages', '2')
    .withAttributes({
      status: 'unhandled',
      sentAt: moment().subtract(moment.duration(1, 'day')),
      cardId: '1',
      cardType: 'chat-messages'
    })
    .withRelated('tags', [requestToPublishLiveTag]);

  initial.addResource('messages', '3')
    .withAttributes({
      // Does it make sense to have a status for a message
      // that is related to a card which cannot be handled? (song, in this case)
      status: 'handled',
      sentAt: moment(),
      cardId: '1',
      cardType: 'songs'
    });

  initial.addResource('messages', '4')
    .withAttributes({
      status: 'unhandled',
      sentAt: moment().subtract(moment.duration(1, 'week')),
      cardId: '1',
      cardType: 'song-license-requests'
    })
    .withRelated('priority', needResponse)
    .withRelated('tags', [licenseRequestTag]);

  initial.addResource('messages', '5')
    .withAttributes({
      status: 'handled',
      sentAt: moment().subtract(moment.duration(4, 'days')),
      cardId: '2',
      cardType: 'songs',
    });

  initial.addResource('messages', '6')
    .withAttributes({
      status: 'unhandled',
      sentAt: moment().subtract(moment.duration(2, 'days')),
      cardId: '2',
      cardType: 'chat-messages'
    });

  initial.addResource('messages', '7')
    .withAttributes({
      status: 'unhandled',
      sentAt: moment(),
      cardId: '2',
      cardType: 'song-license-requests'
    })
    .withRelated('priority', fyi)
    .withRelated('tags', [licenseRequestTag]);

  initial.addResource('messages', '8')
    .withAttributes({
      status: 'unhandled',
      sentAt: moment().subtract(moment.duration(1, 'day')),
      cardId: '2',
      cardType: 'song-change-requests'
    })
    .withRelated('priority', delegated)
    .withRelated('tags', [songChangeRequestTag]);

  initial.addResource('messages', '9')
    .withAttributes({
      status: 'unhandled',
      sentAt: moment(),
      cardId: '3',
      cardType: 'song-license-requests'
    })
    .withRelated('priority', needResponse)
    .withRelated('tags', [licenseRequestTag]);

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
      'may-read-fields': true,
      'may-write-field': true
    }
  }
];
