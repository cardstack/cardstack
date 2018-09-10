import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import '@ember/test-helpers';
import Fixtures from '@cardstack/test-support/fixtures';
import RSVP from 'rsvp';

const articleBody = {
  'atoms': [],
  'cards': [],
  'markups': [
    [
      'strong'
    ]
  ],
  'version': '0.3.1',
  'sections': [
    [
      1,
      'p', [
        [
          0, [],
          0,
          'In an interview with podcast Bad Crypto, Cardstack director Chris Tse spoke about the community the Cardstack Project aims to create, and how he hopes to attract the diverse kinds of developers, designers, and other talent that will be needed to make the ecosystem successful.'
        ]
      ]
    ],
    [
      1,
      'p', [
        [
          0, [],
          0,
          'Here are four reasons you should build using Cardstack and become a part of the Cardstack community, no matter what your background or blockchain expertise level.'
        ]
      ]
    ],
    [
      1,
      'h2', [
        [
          0, [
            0
          ],
          1,
          '1. Let the Hub do the heavy lifting'
        ]
      ]
    ],
    [
      1,
      'p', [
        [
          0, [],
          0,
          'Right now if you’re a developer, you have to make a decision — day one — about which path you’re going to take with a project — web, peer-to-peer, mobile, etc.'
        ]
      ]
    ],
    [
      1,
      'p', [
        [
          0, [],
          0,
          'If you choose the Web, you’ll have to figure out how to monetize, through fees or advertising. If you choose peer-to-peer, you’ll probably have to navigate the enormously complicated undertaking of creating your own token, figuring out smart contracts, and much more.'
        ]
      ]
    ],
    [
      1,
      'p', [
        [
          0, [],
          0,
          'For someone who just wants to code like they’re used to without signing their life away to the blockchain quite yet, that sure is a lot to ask.'
        ]
      ]
    ],
    [
      1,
      'p', [
        [
          0, [],
          0,
          'Because Cardstack, as a framework, allows you to deploy in a peer-to-peer or hosted way, a developer can easily dip their toe into decentralization using Cardstack’s open source toolkit. The idea is that with enough developers and designers using Cardstack as a user interface onramp, we’ll have a true decentralized software ecosystem.'
        ]
      ]
    ],
    [
      1,
      'p', [
        [
          0, [],
          0,
          'Chris explained:'
        ]
      ]
    ],
    [
      1,
      'blockquote', [
        [
          0, [],
          0,
          '“Cardstack provides a framework that has a plug-in system; each plug-in connects to each blockchain of decentralized protocol. It can even connect to the cloud, existing UI or existing cloud services. On top of that, developers, don’t need to be blockchain developers, just great, motivated, application developers who used do web and iOS development now say, Hey, I have a Cardstack framework. It’s like other frameworks I’ve used, and look — I’m doing blockchain application on top of the plug-in framework without having to learn the quirkiness of how decentralized applications are working today.'
        ]
      ]
    ],
    [
      1,
      'blockquote', [
        [
          0, [],
          0,
          '“There’s no way for those software developers, design firms, and product firms to get into crypto because they have to go way low-level, go into Ethereum and build solidity, which is not really what they do. They build beautiful apps that people find useful and they love.”'
        ]
      ]
    ],
    [
      1,
      'h2', [
        [
          0, [],
          0,
          '2. Rewrite the playbook'
        ]
      ]
    ],
    [
      1,
      'p', [
        [
          0, [],
          0,
          'The exciting challenge in blockchain development right now is figuring out how to create a user experience that matches or exceeds the offerings from Silicon Valley superpowers. Whoever cracks this puzzle will set the standards for the decentralized Internet of the future.'
        ]
      ]
    ],
    [
      1,
      'p', [
        [
          0, [],
          0,
          'By contributing to Cardstack, Chris says you’ll be an integral part of the trailblazing:'
        ]
      ]
    ],
    [
      1,
      'blockquote', [
        [
          0, [],
          0,
          '“The way we make technology easy is we bring developers, product designers and user interface experts and say, “Why don’t you build me a beautiful UI, a component, a module, a tab, an app or what we call “carts,” a block of information that allows you to visualize what is actually going on, on-chain, and then coordinate them?”'
        ]
      ]
    ]
  ]
};

module('Integration | Read Time', function(hooks) {
  setupTest(hooks);

  let scenario = new Fixtures({
    create(factory) {
      factory.addResource('content-types', 'articles')
        .withRelated('fields', [
          factory.addResource('fields', 'text').withAttributes({ fieldType: '@cardstack/mobiledoc' }),

          factory.addResource('computed-fields', 'read-time')
            .withAttributes({
              computedFieldType: '@cardstack/mobiledoc::read-time',
              params: {
                sourceField: 'text',
              }
            }),
        ]);

      factory.addResource('articles', '1')
        .withAttributes({
          text: articleBody
        });

      let chorus = "Because I'm happy, Clap along if you feel like a room without a roof.";

      factory.addResource('articles', '2')
        .withAttributes({
          text: Object.assign({}, articleBody, {
            sections: [
              1,
              'p', [
                [
                  0, [],
                  0,
                  chorus.repeat(40), // long read time
                ]
              ]
            ]
          })
        })


      factory.addResource('data-sources', 'mock-auth').
        withAttributes({
          sourceType: '@cardstack/mock-auth',
          mayCreateUser: true,
          params: {
            users: {
              // TODO: we only need `verified` because the mock-auth
              // module is unnecessarily specialized. We should
              // simplify it down to a very barebones user so this can
              // just say `'sample-user': { }`.
              'sample-user': { verified: true }
            }
          }
        })
      factory.addResource('grants')
        .withAttributes({
          mayWriteFields: true,
          mayReadFields: true,
          mayCreateResource: true,
          mayReadResource: true,
          mayUpdateResource: true,
          mayDeleteResource: true,
          mayLogin: true
        })
        .withRelated('who', [{ type: 'mock-users', id: 'sample-user' }]);
    },

    destroy() {
      return [{
        type: 'articles'
      }];
    }
  });

  scenario.setupTest(hooks);

  hooks.beforeEach(async function() {
    await this.owner.lookup('service:cardstack-codegen').refreshCode();
    await this.owner.lookup('service:mock-login').get('login').perform('sample-user');
    this.store = this.owner.lookup('service:store');
   });

  test('it can findRecord', async function(assert) {
    let model = await run(() => {
      return this.store.findRecord('articles', '1');
    });

    // debugger;
    assert.equal(model.get('readTime'), 'anything!');
  });

  // Ember runloop.
  function run(fn) {
    return RSVP.resolve().then(() => fn.apply(this, arguments));
  }
});
