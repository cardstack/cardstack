import { CardSpace } from '../../routes/card-spaces';
import CardSpaceValidator from '../../services/validators/card-space';
import { createTestEnv } from '../helpers';
import { Registry } from '@cardstack/di';

describe('CardSpaceValidator', function () {
  let destroy: () => Promise<void>;

  async function createSubject(registryCallback?: (registry: Registry) => void): Promise<CardSpaceValidator> {
    let container;
    ({ container, destroy } = await createTestEnv(registryCallback));
    return await container.lookup('card-space-validator');
  }

  afterEach(async function () {
    await destroy();
  });

  let invalidUrls = [
    'www.card.space',
    'ščž.card.space',
    '😂.card.space',
    'satoshi.card.race',
    'test',
    'satoshi.nakamoto.card.space',
    '.card.space',
    'ftp.card.space',
    'cardstack.card.space',
    'christse.card.space',
    'fuck.card.space',
  ];

  invalidUrls.forEach(async (url) => {
    it(`should validate ${url}`, async function () {
      let subject = await createSubject();
      let errors = await subject.validate({ url } as CardSpace);
      expect(errors.url).to.have.length.above(0);
    });
  });

  it('validates urls', async function () {
    let subject = await createSubject();

    const cardSpace: CardSpace = {
      id: '',
      url: 'invalid',
      profileImageUrl: 'invalid',
      profileCoverImageUrl: 'invalid',
    };

    let errors = await subject.validate(cardSpace);
    expect(errors.url).deep.equal(['Can only contain latin letters, numbers, hyphens and underscores']);
    expect(errors.profileImageUrl).deep.equal(['Invalid URL']);
    expect(errors.profileCoverImageUrl).deep.equal(['Invalid URL']);
  });

  it('validates text field attributes', async function () {
    let subject = await createSubject();

    const cardSpace: CardSpace = {
      id: '',
      url: 'mike.card.space',
      profileName: 'long string'.repeat(100),
      profileDescription: 'long string'.repeat(100),
      profileButtonText: 'long string'.repeat(100),
      profileCategory: 'long string'.repeat(100),
      bioTitle: 'long string'.repeat(100),
      bioDescription: 'long string'.repeat(100),
      donationTitle: 'long string'.repeat(100),
      donationDescription: 'long string'.repeat(100),
    };

    let errors = await subject.validate(cardSpace);
    expect(errors.profileName).deep.equal(['Max length is 50']);
    expect(errors.profileDescription).deep.equal(['Max length is 300']);
    expect(errors.profileButtonText).deep.equal([
      'Needs to be one of the: Visit this Space, Visit this Business, Visit this Creator, Visit this Person',
    ]);
    expect(errors.profileCategory).deep.equal(['Max length is 50']);
    expect(errors.bioTitle).deep.equal(['Max length is 50']);
    expect(errors.bioDescription).deep.equal(['Max length is 300']);
    expect(errors.donationTitle).deep.equal(['Max length is 50']);
    expect(errors.donationDescription).deep.equal(['Max length is 300']);
  });

  it('validates links', async function () {
    let subject = await createSubject();
    const cardSpace: CardSpace = {
      id: '',
      url: 'mike.card.space',
      links: [
        { title: '', url: 'sth' },
        { title: 'My Twitter', url: 'https://twitter.com/x' },
        { title: 'very very very loooooong long long long long long string', url: null },
      ],
    };

    let errors = await subject.validate(cardSpace);
    expect(errors.links).deep.equal([
      {
        index: 0,
        attribute: 'title',
        detail: 'Must be present',
      },
      {
        index: 0,
        attribute: 'url',
        detail: 'Invalid URL',
      },
      {
        index: 2,
        attribute: 'title',
        detail: 'Max length is 50',
      },
      {
        index: 2,
        attribute: 'url',
        detail: 'Must be present',
      },
    ]);
  });

  it('validates the donation attributes', async function () {
    let subject = await createSubject();

    const cardSpace: CardSpace = {
      id: '',
      url: 'mike.card.space',
      // @ts-ignore
      donationSuggestionAmount1: '...',
      // @ts-ignore
      donationSuggestionAmount2: 'million',
      // @ts-ignore
      donationSuggestionAmount3: 'million',
      // @ts-ignore
      donationSuggestionAmount4: 'million',
    };

    let errors = await subject.validate(cardSpace);
    expect(errors.donationSuggestionAmount1).deep.equal(['Must be an integer']);
    expect(errors.donationSuggestionAmount2).deep.equal(['Must be an integer']);
    expect(errors.donationSuggestionAmount3).deep.equal(['Must be an integer']);
    expect(errors.donationSuggestionAmount4).deep.equal(['Must be an integer']);
  });
});
