const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

const { createDefaultEnvironment, destroyDefaultEnvironment } = require('@cardstack/test-support/env');

const articleBody = {
  atoms: [],
  cards: [],
  markups: [['strong']],
  version: '0.3.1',
  sections: [
    [
      1,
      'p',
      [
        [
          0,
          [],
          0,
          'In an interview with podcast Bad Crypto, Cardstack director Chris Tse spoke about the community the Cardstack Project aims to create, and how he hopes to attract the diverse kinds of developers, designers, and other talent that will be needed to make the ecosystem successful.',
        ],
      ],
    ],
    [
      1,
      'p',
      [
        [
          0,
          [],
          0,
          'Here are four reasons you should build using Cardstack and become a part of the Cardstack community, no matter what your background or blockchain expertise level.',
        ],
      ],
    ],
    [1, 'h2', [[0, [0], 1, '1. Let the Hub do the heavy lifting']]],
    [
      1,
      'p',
      [
        [
          0,
          [],
          0,
          'Right now if you’re a developer, you have to make a decision — day one — about which path you’re going to take with a project — web, peer-to-peer, mobile, etc.',
        ],
      ],
    ],
    [
      1,
      'p',
      [
        [
          0,
          [],
          0,
          'If you choose the Web, you’ll have to figure out how to monetize, through fees or advertising. If you choose peer-to-peer, you’ll probably have to navigate the enormously complicated undertaking of creating your own token, figuring out smart contracts, and much more.',
        ],
      ],
    ],
    [
      1,
      'p',
      [
        [
          0,
          [],
          0,
          'For someone who just wants to code like they’re used to without signing their life away to the blockchain quite yet, that sure is a lot to ask.',
        ],
      ],
    ],
    [
      1,
      'p',
      [
        [
          0,
          [],
          0,
          'Because Cardstack, as a framework, allows you to deploy in a peer-to-peer or hosted way, a developer can easily dip their toe into decentralization using Cardstack’s open source toolkit. The idea is that with enough developers and designers using Cardstack as a user interface onramp, we’ll have a true decentralized software ecosystem.',
        ],
      ],
    ],
    [1, 'p', [[0, [], 0, 'Chris explained:']]],
    [
      1,
      'blockquote',
      [
        [
          0,
          [],
          0,
          '“Cardstack provides a framework that has a plug-in system; each plug-in connects to each blockchain of decentralized protocol. It can even connect to the cloud, existing UI or existing cloud services. On top of that, developers, don’t need to be blockchain developers, just great, motivated, application developers who used do web and iOS development now say, Hey, I have a Cardstack framework. It’s like other frameworks I’ve used, and look — I’m doing blockchain application on top of the plug-in framework without having to learn the quirkiness of how decentralized applications are working today.',
        ],
      ],
    ],
    [
      1,
      'blockquote',
      [
        [
          0,
          [],
          0,
          '“There’s no way for those software developers, design firms, and product firms to get into crypto because they have to go way low-level, go into Ethereum and build solidity, which is not really what they do. They build beautiful apps that people find useful and they love.”',
        ],
      ],
    ],
    [1, 'h2', [[0, [], 0, '2. Rewrite the playbook']]],
    [
      1,
      'p',
      [
        [
          0,
          [],
          0,
          'The exciting challenge in blockchain development right now is figuring out how to create a user experience that matches or exceeds the offerings from Silicon Valley superpowers. Whoever cracks this puzzle will set the standards for the decentralized Internet of the future.',
        ],
      ],
    ],
    [1, 'p', [[0, [], 0, 'By contributing to Cardstack, Chris says you’ll be an integral part of the trailblazing:']]],
    [
      1,
      'blockquote',
      [
        [
          0,
          [],
          0,
          '“The way we make technology easy is we bring developers, product designers and user interface experts and say, “Why don’t you build me a beautiful UI, a component, a module, a tab, an app or what we call “carts,” a block of information that allows you to visualize what is actually going on, on-chain, and then coordinate them?”',
        ],
      ],
    ],
  ],
};

describe('mobiledoc/read-time-computed-field', function() {
  let env, article1, article2, article3;

  async function setup() {
    let factory = new JSONAPIFactory();

    factory.addResource('content-types', 'articles').withRelated('fields', [
      factory.addResource('fields', 'text').withAttributes({ fieldType: '@cardstack/mobiledoc' }),

      factory.addResource('computed-fields', 'read-time').withAttributes({
        computedFieldType: '@cardstack/mobiledoc::read-time',
        params: {
          sourceField: 'text',
        },
      }),
    ]);

    article1 = factory.addResource('articles', '1').withAttributes({
      text: articleBody,
    });

    let chorus = "Because I'm happy, Clap along if you feel like a room without a roof.";

    article2 = factory.addResource('articles', '2').withAttributes({
      text: Object.assign({}, articleBody, {
        sections: [
          [
            1,
            'p',
            [
              [
                0,
                [],
                0,
                chorus.repeat(400), // long read time
              ],
            ],
          ],
        ],
      }),
    });

    article3 = factory.addResource('articles', '3');

    env = await createDefaultEnvironment(`${__dirname}/../`, factory.getModels());
  }

  async function teardown() {
    await destroyDefaultEnvironment(env);
  }

  describe('read-only', function() {
    before(setup);
    after(teardown);

    it('can report a reasonable read time for a short article', async function() {
      let model = await env.lookup('hub:searchers').get(env.session, 'master', 'articles', article1.id);
      expect(model.data).has.deep.property('attributes.read-time', 2);
    });

    it('can report a significantly longer time for a much longer article', async function() {
      let model = await env.lookup('hub:searchers').get(env.session, 'master', 'articles', article2.id);
      expect(model.data).has.deep.property('attributes.read-time', 26);
    });

    it('reports 0 read-time for an article that has undefined sourceField', async function() {
      let model = await env.lookup('hub:searchers').get(env.session, 'master', 'articles', article3.id);
      expect(model.data).has.deep.property('attributes.read-time', 0);
    });
  });
});
