/*
  Our npm package cannot depend on @cardstack/test-support
  because @cardstack/test-support depends on us. Instead, for our
  tests we have a separate "test-app" that holds our devDependencies.
*/

const {
  createDefaultEnvironment,
  destroyDefaultEnvironment,
} = require('../../../tests/pgsearch-test-app/node_modules/@cardstack/test-support/env');
const Factory = require('../../../tests/pgsearch-test-app/node_modules/@cardstack/test-support/jsonapi-factory');
const { cardContextFromId, addContextForCardDefinition, modelsOf, currentVersionLabel } = require('@cardstack/plugin-utils/card-context');
const sourceId = 'local-hub';

describe('pgsearch/indexer', function() {

  let env, writer, indexer, searcher, changedModels;

  before(async function() {
    this.timeout(5000);

    let cards = [];
    let factory = new Factory();
    cards.push(addContextForCardDefinition(sourceId, 'puppy-card', factory.getDocumentFor(
      factory.addResource('card-definitions')
        .withRelated('model', factory.addResource('content-types')
          .withAttributes({
            name: 'puppies',
            defaultIncludes: ['thoughts', 'favorite-toy']
          })
          .withRelated('fields', [
            factory.addResource('fields').withAttributes({
              name: 'name',
              'is-metadata': true,
              'needed-when-embedded': true,
              fieldType: '@cardstack/core-types::string'
            }),
            factory.addResource('fields').withAttributes({
              name: 'puppy-friends',
              'is-metadata': true,
              fieldType: '@cardstack/core-types::has-many'
            }),
            factory.addResource('computed-fields').withAttributes({
              name: 'current-thought',
              'is-metadata': true,
              'needed-when-embedded': true,
              computedFieldType: 'puppy-thoughts::current-thought'
            }),
            factory.addResource('fields').withAttributes({
              name: 'thoughts',
              fieldType: '@cardstack/core-types::has-many'
            }).withRelated('related-content-types', [
              factory.addResource('content-types')
                .withAttributes({ name: 'thoughts' })
                .withRelated('fields', [
                  factory.addResource('fields').withAttributes({
                    name: 'description',
                    fieldType: '@cardstack/core-types::string'
                  })
                ])
              ]),
            factory.addResource('computed-fields').withAttributes({
              name: 'toy',
              'is-metadata': true,
              computedFieldType: 'puppy-thoughts::toy'
            }),
            factory.addResource('fields').withAttributes({
              name: 'favorite-toy',
              fieldType: '@cardstack/core-types::belongs-to'
            }).withRelated('related-content-types', [
              factory.addResource('content-types')
                .withAttributes({ name: 'toys' })
                .withRelated('fields', [
                  factory.addResource('fields').withAttributes({
                    name: 'toy-name',
                    fieldType: '@cardstack/core-types::string'
                  })
                ])
              ])
          ]))
    )));

    factory = new Factory();
    cards.push(addContextForCardDefinition(sourceId, 'article-card', factory.getDocumentFor(
      factory.addResource('card-definitions')
        .withRelated('model', factory.addResource('content-types')
          .withAttributes({
            name: 'articles',
            defaultIncludes: ['author', 'reviewers']
          }).withRelated('fields', [
            factory.addResource('fields').withAttributes({
              name: 'title',
              'is-metadata': true,
              fieldType: '@cardstack/core-types::string'
            }),
            factory.addResource('fields').withAttributes({
              name: 'author',
              'is-metadata': true,
              fieldType: '@cardstack/core-types::belongs-to'
            }).withRelated('related-types', [{ type: 'content-types', id: 'cards' }]),
            factory.addResource('fields').withAttributes({
              name: 'reviewers',
              'is-metadata': true,
              fieldType: '@cardstack/core-types::has-many'
            }).withRelated('related-types', [{ type: 'content-types', id: 'cards' }]),
          ]))
    )));

    factory = new Factory();
    cards.push(addContextForCardDefinition(sourceId, 'person-card', factory.getDocumentFor(
      factory.addResource('card-definitions')
        .withRelated('model', factory.addResource('content-types')
          .withAttributes({
            name: 'people',
            defaultIncludes: ['friends'],
          })
          .withRelated('fields', [
            factory.addResource('fields').withAttributes({
              name: 'name',
              'is-metadata': true,
              'needed-when-embedded': true,
              fieldType: '@cardstack/core-types::string'
            }),
            factory.addResource('fields').withAttributes({
              name: 'friends',
              'is-metadata': true,
              fieldType: '@cardstack/core-types::has-many'
            }).withRelated('related-types', [{ type: 'content-types', id: 'cards' }]),
          ]))
    )));
    let cardModels = [];
    cards.forEach(card => cardModels = cardModels.concat(modelsOf(card)));

    factory = new Factory();
    changedModels = [];
    factory.addResource('data-sources')
      .withAttributes({
        'source-type': 'fake-indexer',
        params: { changedModels }
      });

    env = await createDefaultEnvironment(`${__dirname}/../../../tests/pgsearch-test-app`, cardModels.concat(factory.getModels()));
    writer = env.lookup('hub:writers');
    indexer = env.lookup('hub:indexers');
    searcher = env.lookup('hub:searchers');
  });

  after(async function() {
    await destroyDefaultEnvironment(env);
  });

  async function alterExpiration(sourceId, packageName, id, interval) {
    let client = env.lookup(`plugin-client:${require.resolve('@cardstack/pgsearch/client')}`);
    let result = await client.query(`update documents set expires = now() + $1 where source=$2 and package_name=$3 and id=$4 and snapshot_version='${currentVersionLabel}'`, [interval, sourceId, packageName, id]);
    if (result.rowCount !== 1) {
      throw new Error(`test was unable to alter expiration`);
    }
  }

  it('indexes card with a belongs-to', async function() {
    let { data:person, included:personIncluded } = await writer.create(env.session, 'local-hub::person-card::people', {
      data: {
        type: 'local-hub::person-card::people',
        attributes: {
          name: 'Quint'
        }
      }
    });
    // TODO move these assertions to hub:cards tests
    expect(person.relationships['card-context'].data.type).to.equal('cards');
    let personCardId = person.relationships['card-context'].data.id;
    expect(personCardId).to.match(/^local-hub::person-card::[^:]+$/);
    expect(personIncluded.length).to.equal(1);
    expect(personIncluded[0].type).to.equal('cards');
    expect(personIncluded[0].id).to.equal(personCardId);
    expect(personIncluded[0].attributes).to.eql({
      name: 'Quint',
      friends: []
    });

    let { data:article, included:articleIncluded } = await writer.create(env.session, 'local-hub::article-card::articles', {
      data: {
        type: 'local-hub::article-card::articles',
        attributes: {
          title: 'Hello World'
        },
        relationships: {
          author: { data: { type: 'cards', id: personCardId } }
        }
      }
    });

    expect(article).has.deep.property('id');
    let articleCardId = article.relationships['card-context'].data.id;
    expect(articleIncluded.length).to.equal(2);
    let includedArticleCardResource = articleIncluded.find(i => i.type === 'cards' && i.id === articleCardId);
    let includedPersonCardResource = articleIncluded.find(i => i.type === 'cards' && i.id === personCardId);

    expect(includedArticleCardResource.relationships.model.data).to.eql({ type: 'local-hub::article-card::articles', id: articleCardId });
    expect(includedArticleCardResource.attributes).to.eql({
      title: 'Hello World',
      reviewers: [],
      author: {
        name: 'Quint',
      }
    });
    expect(includedPersonCardResource.relationships.model.data).to.eql({ type: 'local-hub::person-card::people', id: personCardId });
    expect(includedPersonCardResource.attributes).to.eql({
      name: 'Quint',
    });

    let { data:articleCard, included:articleCardIncluded} = await searcher.get(env.session, 'local-hub', 'article-card', articleCardId);
    expect(articleCard.relationships.model.data).to.eql({ type: 'local-hub::article-card::articles', id: article.id });
    expect(articleCard.attributes).to.eql({
      title: 'Hello World',
      reviewers: [],
      author: {
        name: 'Quint',
      }
    });
    expect(articleCardIncluded).to.be.not.ok;
  });

  it('indexes card internal models', async function() {
    let { data:puppy, included } = await writer.create(env.session, 'local-hub::puppy-card::puppies', {
      data: {
        type: 'local-hub::puppy-card::puppies',
        attributes: {
          name: 'Van Gogh'
        }
      }
    });
    let { meta: { version } } = puppy;
    expect(puppy).has.deep.property('id');
    expect(included[0].attributes).to.eql({
      name: 'Van Gogh',
      toy: undefined,
      'current-thought': undefined,
      'puppy-friends': []
    });
    let { cardId:puppyCardIdPart } = cardContextFromId(puppy.id);

    let { data:thought, included:thoughtIncluded } = await writer.create(env.session, 'local-hub::puppy-card::thoughts', {
      data: {
        type: 'local-hub::puppy-card::thoughts',
        attributes:  {
          description: 'I wanna play!'
        }
      }
    }, puppy.id);
    expect(thought.id).to.match(new RegExp(`^local-hub::puppy-card::${puppyCardIdPart}::[^:]+$`));
    expect(thought.relationships['card-context'].data).to.eql({ type: 'cards', id: puppy.id});
    expect(thought.attributes.description).to.equal('I wanna play!');
    expect(thoughtIncluded.length).to.equal(1);
    expect(thoughtIncluded[0].type).to.equal('cards');
    expect(thoughtIncluded[0].id).to.equal(puppy.id);
    expect(thoughtIncluded[0].relationships.model.data).to.eql({ type: puppy.type, id: puppy.id});
    expect(thoughtIncluded[0].relationships['all-models'].data).to.eql([
      { type: puppy.type, id: puppy.id},
      { type: thought.type, id: thought.id }
    ]);
    expect(thoughtIncluded[0].attributes).to.eql({
      name: 'Van Gogh',
      toy: undefined,
      'current-thought': undefined,
      'puppy-friends': [],
    });

    // Now we actually make a formal relationship between the puppy and its internal thought model
    let { data:updatedPuppy, included:updatedPuppyIncluded } = await writer.update(env.session, 'local-hub::puppy-card::puppies', puppy.id, {
      data: {
        type: 'local-hub::puppy-card::puppies',
        attributes: {
          name: 'Van Gogh'
        },
        relationships: {
          thoughts: {
            data: [{ type: 'local-hub::puppy-card::thoughts', id: thought.id }]
          }
        },
        meta: { version }
      }
    });
    expect(updatedPuppyIncluded.length).to.equal(2);
    expect(updatedPuppy.attributes['current-thought']).to.equal('I wanna play!');
    let updatedPuppyThought = updatedPuppyIncluded.find(i => i.type === 'local-hub::puppy-card::thoughts' && i.id === thought.id);
    let updatedPuppyCard = updatedPuppyIncluded.find(i => i.type === 'cards' && i.id === puppy.id);
    expect(updatedPuppyThought.attributes.description).to.equal('I wanna play!');
    expect(updatedPuppyCard.attributes).to.eql({
      name: 'Van Gogh',
      toy: undefined,
      'puppy-friends': [],
      'current-thought': 'I wanna play!'
    });

    let { data:puppyCard, included:puppyCardIncluded} = await searcher.get(env.session, 'local-hub', 'puppy-card', puppy.id);
    expect(puppyCard.relationships.model.data).to.eql({ type: 'local-hub::puppy-card::puppies', id: puppy.id });
    expect(puppyCard.relationships['all-models'].data).to.eql([
      { type: puppy.type, id: puppy.id},
      { type: thought.type, id: thought.id }
    ]);
    expect(puppyCard.attributes).to.eql({
      name: 'Van Gogh',
      toy: undefined,
      'puppy-friends': [],
      'current-thought': 'I wanna play!'
    });
    expect(puppyCardIncluded).to.be.not.ok;
  });

  // this scenario technically violates jsonapi spec, but our indexer needs to be tolerant of it
  it('tolerates missing relationship', async function() {
    let { data:article } = await writer.create(env.session, 'local-hub::article-card::articles', {
      data: {
        type: 'local-hub::article-card::articles',
        attributes: {
          title: 'Hello World'
        },
        relationships: {
          author: null
        }
      }
    });
    expect(article).has.deep.property('id');

    let { data:articleCard, included:[model] } = await searcher.get(env.session, 'local-hub', 'article-card', article.id, { includePaths: ['model'] });
    expect(articleCard.attributes).to.eql({
      title: 'Hello World',
      reviewers: []
    });
    expect(model.relationships.author.data).to.not.be.ok;
  });

  it('indexes card that is related to itself', async function() {
    let { data:person } = await writer.create(env.session, 'local-hub::person-card::people', {
      data: {
        type: 'local-hub::person-card::people',
        attributes: {
          name: 'Van Gogh'
        }
      }
    });
    let { meta: { version } } = person;
    await writer.update(env.session, 'local-hub::person-card::people', person.id, {
      data: {
        id: person.id,
        type: 'local-hub::person-card::people',
        attributes: {
          name: 'Van Gogh'
        },
        relationships: {
          friends: { data: [{ type: 'cards', id: person.id }] }
        },
        meta: { version }
      }
    });

    let { data:personCard, included:[model] } = await searcher.get(env.session, 'local-hub', 'person-card', person.id, { includePaths: ['model']});
    expect(personCard.relationships.model.data).to.eql({ type: 'local-hub::person-card::people', id: person.id });
    expect(personCard.attributes).to.eql({
      name: 'Van Gogh',
      friends: [{
        name: 'Van Gogh'
      }]
    });
    expect(model.attributes.name).to.equal('Van Gogh');
    expect(model.relationships.friends.data.length).to.equal(1);
    expect(model.relationships.friends.data[0]).to.eql({ type: 'cards', id: person.id });
  });

  it('indexes card that includes a card which has a relation to itself', async function() {
    let { data:circularPerson } = await writer.create(env.session, 'local-hub::person-card::people', {
      data: {
        type: 'local-hub::person-card::people',
        attributes: {
          name: 'Van Gogh'
        }
      }
    });
    let { meta: { version } } = circularPerson;
    await writer.update(env.session, 'local-hub::person-card::people', circularPerson.id, {
      data: {
        id: circularPerson.id,
        type: 'local-hub::person-card::people',
        attributes: {
          name: 'Van Gogh'
        },
        relationships: {
          friends: { data: [{ type: 'cards', id: circularPerson.id }] }
        },
        meta: { version }
      }
    });
    let { data:person } = await writer.create(env.session, 'local-hub::person-card::people', {
      data: {
        type: 'local-hub::person-card::people',
        attributes: {
          name: 'Ringo'
        },
        relationships: {
          friends: { data: [{ type: 'cards', id: circularPerson.id }] }
        }
      }
    });

    let { data:personCard, included:[model] } = await searcher.get(env.session, 'local-hub', 'person-card', person.id, { includePaths: ['model']});
    expect(personCard.relationships.model.data).to.eql({ type: 'local-hub::person-card::people', id: person.id });
    expect(personCard.attributes).to.eql({
      name: 'Ringo',
      friends: [{
        name: 'Van Gogh'
      }]
    });
    expect(model.attributes.name).to.equal('Ringo');
    expect(model.relationships.friends.data.length).to.equal(1);
    expect(model.relationships.friends.data[0]).to.eql({ type: 'cards', id: circularPerson.id });

    let { data:circularPersonCard, included } = await searcher.get(env.session, 'local-hub', 'person-card', circularPerson.id, { includePaths: ['model']});
    model = included[0];
    expect(circularPersonCard.relationships.model.data).to.eql({ type: 'local-hub::person-card::people', id: circularPerson.id });
    expect(circularPersonCard.attributes).to.eql({
      name: 'Van Gogh',
      friends: [{
        name: 'Van Gogh'
      }]
    });
    expect(model.attributes.name).to.equal('Van Gogh');
    expect(model.relationships.friends.data.length).to.equal(1);
    expect(model.relationships.friends.data[0]).to.eql({ type: 'cards', id: circularPerson.id });
  });

  it('indexes a circular relationship', async function() {
    let { data:person1 } = await writer.create(env.session, 'local-hub::person-card::people', {
      data: {
        type: 'local-hub::person-card::people',
        attributes: {
          name: 'Hassan'
        }
      }
    });
    let { meta: { version:person1Version } } = person1;
    let { data:person2 } = await writer.create(env.session, 'local-hub::person-card::people', {
      data: {
        type: 'local-hub::person-card::people',
        attributes: {
          name: 'Van Gogh'
        }
      }
    });
    let { meta: { version:person2Version } } = person2;

    await writer.update(env.session, 'local-hub::person-card::people', person1.id, {
      data: {
        id: person1.id,
        type: 'local-hub::person-card::people',
        attributes: {
          name: 'Hassan'
        },
        relationships: {
          friends: { data: [{ type: 'cards', id: person2.id }] }
        },
        meta: { version: person1Version }
      }
    });
    await writer.update(env.session, 'local-hub::person-card::people', person2.id, {
      data: {
        id: person2.id,
        type: 'local-hub::person-card::people',
        attributes: {
          name: 'Van Gogh'
        },
        relationships: {
          friends: { data: [{ type: 'cards', id: person1.id }] }
        },
        meta: { version: person2Version }
      }
    });

    let { data:person1Card, included:[person1Model] } = await searcher.get(env.session, 'local-hub', 'person-card', person1.id, { includePaths: [ 'model']});
    expect(person1Card.relationships.model.data).to.eql({ type: 'local-hub::person-card::people', id: person1.id });
    expect(person1Card.attributes).to.eql({
      name: 'Hassan',
      friends: [{
        name: 'Van Gogh'
      }]
    });
    expect(person1Model.attributes.name).to.equal('Hassan');
    expect(person1Model.relationships.friends.data.length).to.equal(1);
    expect(person1Model.relationships.friends.data[0]).to.eql({ type: 'cards', id: person2.id });

    let { data:person2Card, included:[person2Model] } = await searcher.get(env.session, 'local-hub', 'person-card', person2.id, { includePaths: ['model']});
    expect(person2Card.relationships.model.data).to.eql({ type: 'local-hub::person-card::people', id: person2.id });
    expect(person2Card.attributes).to.eql({
      name: 'Van Gogh',
      friends: [{
        name: 'Hassan'
      }]
    });
    expect(person2Model.attributes.name).to.equal('Van Gogh');
    expect(person2Model.relationships.friends.data.length).to.equal(1);
    expect(person2Model.relationships.friends.data[0]).to.eql({ type: 'cards', id: person1.id });
  });

  it('reindexes card with a relationship to another card whose card metadata has changed', async function() {
    let { data:person1 } = await writer.create(env.session, 'local-hub::person-card::people', {
      data: {
        type: 'local-hub::person-card::people',
        attributes: {
          name: 'Hassan'
        }
      }
    });
    let { meta: { version:person1Version } } = person1;
    let { data:person2 } = await writer.create(env.session, 'local-hub::person-card::people', {
      data: {
        type: 'local-hub::person-card::people',
        attributes: {
          name: 'Van Gogh'
        },
        relationships: {
          friends: { data: [{ type: 'cards', id: person1.id }] }
        },
      }
    });
    let { data:person2Card  } = await searcher.get(env.session, 'local-hub', 'person-card', person2.id);
    expect(person2Card.attributes).to.eql({
      name: 'Van Gogh',
      friends: [{
        name: 'Hassan'
      }]
    });

    await writer.update(env.session, 'local-hub::person-card::people', person1.id, {
      data: {
        id: person1.id,
        type: 'local-hub::person-card::people',
        attributes: {
          name: 'New Hassan'
        },
        meta: { version: person1Version }
      }
    });

    let found = await searcher.get(env.session, 'local-hub', 'person-card', person2.id);
    expect(found.data.attributes).to.eql({
      name: 'Van Gogh',
      friends: [{
        name: 'New Hassan'
      }]
    });
  });

  it(`reindexes card's internal models`, async function() {
    let { data:puppy  } = await writer.create(env.session, 'local-hub::puppy-card::puppies', {
      data: {
        type: 'local-hub::puppy-card::puppies',
        attributes: {
          name: 'Van Gogh'
        }
      }
    });
    let { meta: { version } } = puppy;
    let { data:thought } = await writer.create(env.session, 'local-hub::puppy-card::thoughts', {
      data: {
        type: 'local-hub::puppy-card::thoughts',
        attributes:  {
          description: 'I wanna play!'
        }
      }
    }, puppy.id);
    let { meta: { version:thoughtVersion } } = thought;
    await writer.update(env.session, 'local-hub::puppy-card::puppies', puppy.id, {
      data: {
        type: 'local-hub::puppy-card::puppies',
        attributes: {
          name: 'Van Gogh'
        },
        relationships: {
          thoughts: {
            data: [{ type: 'local-hub::puppy-card::thoughts', id: thought.id }]
          }
        },
        meta: { version }
      }
    });
    let { included } = await writer.update(env.session, 'local-hub::puppy-card::thoughts', thought.id, {
      data: {
        id: thought.id,
        type: 'local-hub::puppy-card::thoughts',
        attributes:  {
          description: 'Time to eat!'
        },
        meta: { version: thoughtVersion }
      }
    });
    expect(included.length).to.equal(1);
    let [ includedPuppyCard ] = included;
    expect(includedPuppyCard.attributes).to.eql({
      name: "Van Gogh",
      toy: undefined,
      'puppy-friends': [],
      'current-thought': 'Time to eat!'
    });

    let { data:puppyCard, included:puppyIncluded } = await searcher.get(env.session, 'local-hub', 'puppy-card', puppy.id);
    expect(puppyIncluded).to.not.be.ok;
    expect(puppyCard.attributes).to.eql({
      name: "Van Gogh",
      toy: undefined,
      'puppy-friends': [],
      'current-thought': 'Time to eat!'
    });
  });

  it('can delete a card', async function() {
    let { data:puppy  } = await writer.create(env.session, 'local-hub::puppy-card::puppies', {
      data: {
        type: 'local-hub::puppy-card::puppies',
        attributes: {
          name: 'Van Gogh'
        }
      }
    });
    let { meta: { version } } = puppy;

    let { data:card } = await searcher.get(env.session, 'local-hub', 'puppy-card', puppy.id);
    expect(card.id).to.be.ok;

    await writer.delete(env.session, version, 'cards', puppy.id);

    let error;
    try {
      await searcher.get(env.session, 'local-hub', 'puppy-card', puppy.id);
    } catch (e) {
      error = e;
    }
    expect(error.status).to.equal(404);
  });

  it(`can delete a card by deleting card's primary model`, async function() {
    let { data:puppy  } = await writer.create(env.session, 'local-hub::puppy-card::puppies', {
      data: {
        type: 'local-hub::puppy-card::puppies',
        attributes: {
          name: 'Van Gogh'
        }
      }
    });
    let { meta: { version } } = puppy;

    let { data:card } = await searcher.get(env.session, 'local-hub', 'puppy-card', puppy.id);
    expect(card.id).to.be.ok;

    await writer.delete(env.session, version, puppy.type, puppy.id);

    let error;
    try {
      await searcher.get(env.session, 'local-hub', 'puppy-card', puppy.id);
    } catch (e) {
      error = e;
    }
    expect(error.status).to.equal(404);
  });

  it(`can delete a card's internal model referenced with has-many relationship`, async function() {
    let { data:puppy  } = await writer.create(env.session, 'local-hub::puppy-card::puppies', {
      data: {
        type: 'local-hub::puppy-card::puppies',
        attributes: {
          name: 'Van Gogh'
        }
      }
    });
    let { meta: { version } } = puppy;
    let { data:thought } = await writer.create(env.session, 'local-hub::puppy-card::thoughts', {
      data: {
        type: 'local-hub::puppy-card::thoughts',
        attributes:  {
          description: 'I wanna play!'
        }
      }
    }, puppy.id);
    let { meta: { version:thoughtVersion } } = thought;
    await writer.update(env.session, 'local-hub::puppy-card::puppies', puppy.id, {
      data: {
        type: 'local-hub::puppy-card::puppies',
        attributes: {
          name: 'Van Gogh'
        },
        relationships: {
          thoughts: {
            data: [{ type: 'local-hub::puppy-card::thoughts', id: thought.id }]
          }
        },
        meta: { version }
      }
    });

    let { data:card } = await searcher.get(env.session, 'local-hub', 'puppy-card', puppy.id);
    expect(card.attributes).to.eql({
      name: 'Van Gogh',
      toy: undefined,
      'current-thought': 'I wanna play!',
      'puppy-friends': []
    });

    // TODO can we return an updated card are part of this response?
    await writer.delete(env.session, thoughtVersion, thought.type, thought.id);

    let found = await searcher.get(env.session, 'local-hub', 'puppy-card', puppy.id, { includePaths: ['all-models']});
    card = found.data;
    let included = found.included;
    expect(card.attributes).to.eql({
      name: 'Van Gogh',
      toy: undefined,
      'current-thought': undefined,
      'puppy-friends': []
    });
    expect(included.length).to.equal(1);
    let thoughtModel = included.find(i => i.type === 'local-hub::puppy-card::thoughts');
    expect(thoughtModel).to.be.not.ok;
  });

  it(`can delete a card's internal model referenced with belongs-to relationship`, async function() {
    let { data:puppy  } = await writer.create(env.session, 'local-hub::puppy-card::puppies', {
      data: {
        type: 'local-hub::puppy-card::puppies',
        attributes: {
          name: 'Van Gogh'
        }
      }
    });
    let { meta: { version } } = puppy;
    let { data:toy } = await writer.create(env.session, 'local-hub::puppy-card::toys', {
      data: {
        type: 'local-hub::puppy-card::toys',
        attributes:  {
          'toy-name': 'squeaky snake'
        }
      }
    }, puppy.id);
    let { meta: { version:toyVersion } } = toy;
    await writer.update(env.session, 'local-hub::puppy-card::puppies', puppy.id, {
      data: {
        type: 'local-hub::puppy-card::puppies',
        attributes: {
          name: 'Van Gogh'
        },
        relationships: {
          'favorite-toy': {
            data: { type: 'local-hub::puppy-card::toys', id: toy.id }
          }
        },
        meta: { version }
      }
    });

    let { data:card } = await searcher.get(env.session, 'local-hub', 'puppy-card', puppy.id);
    expect(card.attributes).to.eql({
      name: 'Van Gogh',
      toy: 'squeaky snake',
      'current-thought': undefined,
      'puppy-friends': []
    });

    await writer.delete(env.session, toyVersion, toy.type, toy.id);

    let found = await searcher.get(env.session, 'local-hub', 'puppy-card', puppy.id, { includePaths: ['all-models']});
    card = found.data;
    let included = found.included;
    expect(card.attributes).to.eql({
      name: 'Van Gogh',
      toy: undefined,
      'current-thought': undefined,
      'puppy-friends': []
    });
    expect(included.length).to.equal(1);
    let toyModel = included.find(i => i.type === 'local-hub::puppy-card::toys');
    expect(toyModel).to.be.not.ok;
  });

  it(`reindexes correctly when related card's models are saved before own card's models`, async function() {
    let { data:person } = await writer.create(env.session, 'local-hub::person-card::people', {
      data: {
        type: 'local-hub::person-card::people',
        attributes: {
          name: 'Quint'
        }
      }
    });
    expect(person).has.deep.property('id');

    let { data:article } = await writer.create(env.session, 'local-hub::article-card::articles', {
      data: {
        type: 'local-hub::article-card::articles',
        attributes: {
          title: 'Hello World'
        },
        relationships: {
          author: { data: { type: 'cards', id: person.id } }
        }
      }
    });
    expect(article).has.deep.property('id');
    await indexer.update({ forceRefresh: true });

    person.attributes.name = 'Edward V';
    article.attributes.title = 'A Better Title';
    changedModels.push({ type: person.type, id: person.id, model: person });
    changedModels.push({ type: article.type, id: article.id, model: article });

    await indexer.update({ forceRefresh: true });

    let { data:articleCard, included:[model]} = await searcher.get(env.session, 'local-hub', 'article-card', article.id, { includePaths: [ 'model' ]});
    expect(articleCard.attributes).to.eql({
      title: 'A Better Title',
      reviewers: [],
      author: {
        name: 'Edward V'
      }
    });
    expect(model).has.deep.property('attributes.title', 'A Better Title');
    expect(model).has.deep.property('relationships.author.data.id', person.id);
  });

  it(`reindexes correctly when related card's models are saved after own card's models`, async function() {
    let { data:person } = await writer.create(env.session, 'local-hub::person-card::people', {
      data: {
        type: 'local-hub::person-card::people',
        attributes: {
          name: 'Quint'
        }
      }
    });
    expect(person).has.deep.property('id');
    let { data:article } = await writer.create(env.session, 'local-hub::article-card::articles', {
      data: {
        type: 'local-hub::article-card::articles',
        attributes: {
          title: 'Hello World'
        },
        relationships: {
          author: { data: { type: 'cards', id: person.id } }
        }
      }
    });
    expect(article).has.deep.property('id');
    await indexer.update({ forceRefresh: true });

    person.attributes.name = 'Edward V';
    article.attributes.title = 'A Better Title';
    changedModels.push({ type: article.type, id: article.id, model: article });
    changedModels.push({ type: person.type, id: person.id, model: person });

    await indexer.update({ forceRefresh: true });

    let { data:articleCard, included:[model]} = await searcher.get(env.session, 'local-hub', 'article-card', article.id, { includePaths: [ 'model' ]});
    expect(articleCard.attributes).to.eql({
      title: 'A Better Title',
      reviewers: [],
      author: {
        name: 'Edward V'
      }
    });
    expect(model).has.deep.property('attributes.title', 'A Better Title');
    expect(model).has.deep.property('relationships.author.data.id', person.id);
  });

  it('invalidates expired cards', async function() {
    let { data:person } = await writer.create(env.session, 'local-hub::person-card::people', {
      data: {
        type: 'local-hub::person-card::people',
        attributes: {
          name: 'Quint'
        }
      }
    });
    let { sourceId, packageName } = cardContextFromId(person.id);
    await alterExpiration(sourceId, packageName, person.id, '300 seconds');

    let { data:article  } = await writer.create(env.session, 'local-hub::article-card::articles', {
      data: {
        type: 'local-hub::article-card::articles',
        attributes: {
          title: 'Hello World'
        },
        relationships: {
          author: { data: { type: 'cards', id: person.id } }
        }
      }
    });

    let { data:articleCard, included:[articleModel]} = await searcher.get(env.session, 'local-hub', 'article-card', article.id, { includePaths: ['model']});
    expect(articleCard.attributes).to.eql({
      title: 'Hello World',
      reviewers: [],
      author: {
        name: 'Quint'
      }
    });
    expect(articleModel.relationships.author.data).to.eql({ type: 'cards', id: person.id});
    let { data:personCard } = await searcher.get(env.session, 'local-hub', 'person-card', person.id);
    expect(personCard).to.be.ok;

    await alterExpiration(sourceId, packageName, person.id, '-300 seconds');
    // just need to touch any document to trigger expired resource invalidation
    await writer.update(env.session, 'local-hub::article-card::articles', article.id, { data: article });

    let found = await searcher.get(env.session, 'local-hub', 'article-card', article.id, { includePaths: ['model']});
    articleCard = found.data;
    articleModel = found.included[0];
    expect(articleCard.attributes).to.eql({
      title: 'Hello World',
      reviewers: [],
    });
    expect(articleModel).has.deep.property('relationships.author.data', null);

    let error;
    try {
      await searcher.get(env.session, 'local-hub', 'person-card', person.id);
    } catch (e) {
      error = e;
    }
    expect(error.status).to.equal(404);
  });

  it('ignores a broken belongs-to', async function() {
    let { data:article  } = await writer.create(env.session, 'local-hub::article-card::articles', {
      data: {
        type: 'local-hub::article-card::articles',
        attributes: {
          title: 'Hello World'
        },
        relationships: {
          author: { data: { type: 'cards', id: 'x' } }
        }
      }
    });
    expect(article).has.deep.property('id');

    let { data: articleCard, included:[model]} = await searcher.get(env.session, 'local-hub', 'article-card', article.id, { includePaths: ['model']});
    expect(articleCard.attributes).to.eql({
      title: 'Hello World',
      reviewers: [],
    });
    expect(model).has.deep.property('relationships.author.data', null);
  });

  it(`ignores a broken belongs-to within a card's internal models`, async function() {
    let { data:puppy } = await writer.create(env.session, 'local-hub::puppy-card::puppies', {
      data: {
        type: 'local-hub::puppy-card::puppies',
        attributes: {
          name: 'Van Gogh'
        },
        relationships: {
          'favorite-toy': {
            data: { type: 'local-hub::puppy-card::toys', id: 'x' }
          }
        },
      }
    });
    expect(puppy).has.deep.property('id');
    let { data:card, included:[model]} = await searcher.get(env.session, 'local-hub', 'puppy-card', puppy.id, { includePaths: ['model']});
    expect(card.attributes).to.eql({
      name: 'Van Gogh',
      toy: undefined,
      'current-thought': undefined,
      'puppy-friends': []
    });
    expect(model).has.deep.property('relationships.favorite-toy.data', null);
  });

  it('ignores a broken has-many', async function() {
    let { data:person } = await writer.create(env.session, 'local-hub::person-card::people', {
      data: {
        type: 'local-hub::person-card::people',
        attributes: {
          name: 'Quint'
        }
      }
    });
    expect(person).has.deep.property('id');

    let { data:article } = await writer.create(env.session, 'local-hub::article-card::articles', {
      data: {
        type: 'local-hub::article-card::articles',
        attributes: {
          title: 'Hello World'
        },
        relationships: {
          reviewers: { data: [{ type: 'cards', id: person.id }, { type: "cards", id: 'x'} ]}
        }
      }
    });
    expect(article).has.deep.property('id');
    let { data:card, included:[model]} = await searcher.get(env.session, 'local-hub', 'article-card', article.id, { includePaths: [ 'model' ]});
    expect(model.relationships.reviewers.data).length(1);
    expect(model.relationships.reviewers.data[0]).to.eql({ type: 'cards', id: person.id });
    expect(card.attributes).to.eql({
      title: 'Hello World',
      reviewers: [{
        name: 'Quint'
      }]
    });
  });

  it(`ignores a broken has-many within a card's internal models`, async function() {
    let { data:puppy } = await writer.create(env.session, 'local-hub::puppy-card::puppies', {
      data: {
        type: 'local-hub::puppy-card::puppies',
        attributes: {
          name: 'Van Gogh'
        },
        relationships: {
          thoughts: {
            data: [{ type: 'local-hub::puppy-card::thoughts', id: 'x' }]
          }
        },
      }
    });
    expect(puppy).has.deep.property('id');
    let { data:card, included:[model]} = await searcher.get(env.session, 'local-hub', 'puppy-card', puppy.id, { includePaths: ['model']});
    expect(card.attributes).to.eql({
      name: 'Van Gogh',
      toy: undefined,
      'current-thought': undefined,
      'puppy-friends': []
    });
    expect(model.relationships.thoughts.data).to.eql([]);
  });

  it('can fix broken relationship when it is later fixed', async function() {
    let { data:article } = await writer.create(env.session, 'local-hub::article-card::articles', {
      data: {
        type: 'local-hub::article-card::articles',
        attributes: {
          title: 'Hello World'
        },
        relationships: {
          author: { data: { type: 'cards', id: 'local-hub::person-card::x' } }
        }
      }
    });
    expect(article).has.deep.property('id');

    let { data:card, included:[model]} = await searcher.get(env.session, 'local-hub', 'article-card', article.id, { includePaths: ['model']});
    expect(card.attributes).to.eql({
      title: 'Hello World',
      reviewers: []
    });
    expect(model).has.deep.property('attributes.title', 'Hello World');
    expect(model).has.deep.property('relationships.author.data', null);

    await writer.create(env.session, 'local-hub::person-card::people', {
      data: {
        id: 'x',
        type: 'local-hub::person-card::people',
        attributes: {
          name: 'Quint'
        }
      }
    });

    let found = await searcher.get(env.session, 'local-hub', 'article-card', article.id, { includePaths: [ 'model']});
    expect(found.included).length(1);
    card = found.data;
    model = found.included[0];
    expect(model.relationships.author.data).to.eql({ type: 'cards', id: 'local-hub::person-card::x' });
    expect(card.attributes).to.eql({
      title: 'Hello World',
      author: {
        name: 'Quint'
      },
      reviewers: []
    });
  });

  it(`can fix broken relationship when it is later fixed within a card's internal models`, async function() {
    let { data:puppy } = await writer.create(env.session, 'local-hub::puppy-card::puppies', {
      data: {
        id: 'vanGogh',
        type: 'local-hub::puppy-card::puppies',
        attributes: {
          name: 'Van Gogh'
        },
        relationships: {
          thoughts: {
            data: [{ type: 'local-hub::puppy-card::thoughts', id: 'local-hub::puppy-card::vanGogh::x' }]
          }
        },
      }
    });
    expect(puppy).has.deep.property('id');

    let { data:card, included:[model]} = await searcher.get(env.session, 'local-hub', 'puppy-card', puppy.id, { includePaths: ['model']});
    expect(card.attributes).to.eql({
      name: 'Van Gogh',
      toy: undefined,
      'current-thought': undefined,
      'puppy-friends': []
    });
    expect(model).has.deep.property('attributes.name', 'Van Gogh');
    expect(model).has.deep.property('attributes.current-thought', undefined);
    expect(model.relationships.thoughts.data).to.eql([]);

    await writer.create(env.session, 'local-hub::puppy-card::thoughts', {
      data: {
        id: 'x',
        type: 'local-hub::puppy-card::thoughts',
        attributes:  {
          description: 'I wanna play!'
        }
      }
    }, puppy.id);

    let found = await searcher.get(env.session, 'local-hub', 'puppy-card', puppy.id, { includePaths: ['model']});
    expect(found.included).length(1);
    card = found.data;
    model = found.included[0];

    expect(card.attributes).to.eql({
      name: 'Van Gogh',
      toy: undefined,
      'current-thought': 'I wanna play!',
      'puppy-friends': []
    });
    expect(model).has.deep.property('attributes.name', 'Van Gogh');
    expect(model).has.deep.property('attributes.current-thought', 'I wanna play!');
    expect(model.relationships.thoughts.data).to.eql([{ type: 'local-hub::puppy-card::thoughts', id: 'local-hub::puppy-card::vanGogh::x' }]);
  });

});
