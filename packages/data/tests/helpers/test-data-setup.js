import { get } from 'lodash';

export default function(factory, opts) {
  let locations = factory.addResource('content-types', 'locations').withRelated('fields', [
    factory.addResource('fields', 'city').withAttributes({
      fieldType: '@cardstack/core-types::string',
    }),
  ]);

  if (get(opts, 'locations.fieldsets')) {
    locations.withAttributes({ fieldsets: opts.locations.fieldsets });
  }
  if (get(opts, 'locations.defaultIncludes')) {
    locations.withAttributes({ defaultIncludes: opts.locations.defaultIncludes });
  }

  let puppies = factory.addResource('content-types', 'puppies').withRelated('fields', [
    factory.addResource('fields', 'nickname').withAttributes({
      fieldType: '@cardstack/core-types::string',
    }),
    factory.addResource('fields', 'bio').withAttributes({
      fieldType: '@cardstack/core-types::string',
    }),
    factory
      .addResource('fields', 'location')
      .withAttributes({
        fieldType: '@cardstack/core-types::belongs-to',
      })
      .withRelated('related-types', [locations]),
  ]);

  if (get(opts, 'puppies.fieldsets')) {
    puppies.withAttributes({ fieldsets: opts.puppies.fieldsets });
  }
  if (get(opts, 'puppies.defaultIncludes')) {
    puppies.withAttributes({ defaultIncludes: opts.puppies.defaultIncludes });
  }

  let doggies = factory.addResource('content-types', 'doggies').withRelated('fields', [
    factory.addResource('fields', 'nickname').withAttributes({
      fieldType: '@cardstack/core-types::string',
    }),
  ]);

  if (get(opts, 'doggies.fieldsets')) {
    doggies.withAttributes({ fieldsets: opts.doggies.fieldsets });
  }
  if (get(opts, 'doggies.defaultIncludes')) {
    doggies.withAttributes({ defaultIncludes: opts.doggies.defaultIncludes });
  }

  let puppyArticles = factory.addResource('content-types', 'puppy-articles').withRelated('fields', [
    factory.addResource('fields', 'title').withAttributes({
      fieldType: '@cardstack/core-types::string',
    }),
    factory.addResource('fields', 'body').withAttributes({
      fieldType: '@cardstack/core-types::string',
    }),
    factory
      .addResource('fields', 'author')
      .withAttributes({
        fieldType: '@cardstack/core-types::belongs-to',
      })
      .withRelated('related-types', [puppies]),
    factory.addResource('fields', 'related-article').withAttributes({
      fieldType: '@cardstack/core-types::belongs-to',
    }),
  ]);

  if (get(opts, 'puppy-articles.fieldsets')) {
    puppyArticles.withAttributes({ fieldsets: opts['puppy-articles'].fieldsets });
  }
  if (get(opts, 'puppy-articles.defaultIncludes')) {
    puppyArticles.withAttributes({ defaultIncludes: opts['puppy-articles'].defaultIncludes });
  }

  let doggyArticles = factory.addResource('content-types', 'doggy-articles').withRelated('fields', [
    factory.addResource('fields', 'title').withAttributes({
      fieldType: '@cardstack/core-types::string',
    }),
    factory.addResource('fields', 'body').withAttributes({
      fieldType: '@cardstack/core-types::string',
    }),
    factory
      .addResource('fields', 'dog')
      .withAttributes({
        fieldType: '@cardstack/core-types::belongs-to',
      })
      .withRelated('related-types', [doggies]),
  ]);

  if (get(opts, 'doggy-articles.fieldsets')) {
    doggyArticles.withAttributes({ fieldsets: opts['doggy-articles'].fieldsets });
  }
  if (get(opts, 'doggy-articles.defaultIncludes')) {
    doggyArticles.withAttributes({ defaultIncludes: opts['doggy-articles'].defaultIncludes });
  }

  let pages = factory.addResource('content-types', 'pages').withRelated('fields', [
    factory.addResource('fields', 'title').withAttributes({
      fieldType: '@cardstack/core-types::string',
    }),
    factory.addResource('fields', 'articles').withAttributes({
      fieldType: '@cardstack/core-types::has-many',
    }), // this relationship is polymorphic, hence no `related-types`
  ]);

  if (get(opts, 'pages')) {
    pages.withAttributes({ fieldsets: opts.pages.fieldsets });
  }
  if (get(opts, 'pages.defaultIncludes')) {
    pages.withAttributes({ defaultIncludes: opts.pages.defaultIncludes });
  }

  let nyc = factory.addResource('locations', 'nyc').withAttributes({
    city: 'New York City',
  });

  let vanGogh = factory
    .addResource('puppies', 'vanGogh')
    .withAttributes({
      nickname: 'Van Gogh',
      bio: 'A cute puppy that loves to play with his squeaky snake',
    })
    .withRelated('location', nyc);

  let ringo = factory.addResource('doggies', 'ringo').withAttributes({
    nickname: 'Ringo',
  });

  let article1 = factory
    .addResource('puppy-articles', 'bones')
    .withAttributes({
      title: 'Top 10 Bones',
      body: 'I really like to chew bones, there are many good bones, but these bones are the best...',
    })
    .withRelated('author', vanGogh)
    .withRelated(
      'related-article',
      factory.addResource('puppy-articles', 'walk').withAttributes({
        title: 'Take Me For a Walk',
        body: "I don't care if it's raining!",
      })
    );

  let article2 = factory
    .addResource('puppy-articles', 'why')
    .withAttributes({
      title: 'Why Doors?',
      body:
        "Do you understand doors? If you're like me doors are probably super confusing, let's get to the bottom of this mystery.",
    })
    .withRelated('author', vanGogh);

  let article3 = factory
    .addResource('doggy-articles', 'swim')
    .withAttributes({
      title: 'I Like to Swim',
      body: 'Swimming is my favorite, and then I love my wet dog smell.',
    })
    .withRelated('dog', ringo);

  factory
    .addResource('pages', 'homepage')
    .withAttributes({
      title: 'Homepage',
    })
    .withRelated('articles', [article1, article2, article3]);
}
