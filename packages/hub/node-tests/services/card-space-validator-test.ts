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

  it('validates urls', async function () {
    let subject = await createSubject();

    const cardSpace: CardSpace = {
      id: '',
      url: 'invalid',
      profileImageUrl: 'invalid',
      profileCoverImageUrl: 'invalid',
    };

    let errors = await subject.validate(cardSpace);
    expect(errors.url).deep.equal([
      'Only card.space subdomains are allowed',
      'Only first level subdomains are allowed',
    ]);
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
      'Title must be present. Link index: 0',
      'Invalid URL. Link index: 0',
      'Max title length is 50. Link index: 2',
      'Link must be present. Link index: 2',
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
