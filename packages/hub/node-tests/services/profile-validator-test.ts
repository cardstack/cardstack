import { Profile } from '@prisma/client';
import { setupHub } from '../helpers/server';

describe('ProfileValidator', function () {
  let { getContainer } = setupHub(this);

  it('validates urls', async function () {
    let subject = await getContainer().lookup('profile-validator');

    const cardSpace: Partial<Profile> = {
      id: '',
      profileImageUrl: 'invalid',
    };

    let errors = await subject.validate(cardSpace);
    expect(errors.profileImageUrl).deep.equal(['Invalid URL']);
  });

  it('validates text field attributes', async function () {
    let subject = await getContainer().lookup('profile-validator');

    const cardSpace: Partial<Profile> = {
      id: '',
      profileDescription: 'long string'.repeat(100),
    };

    let errors = await subject.validate(cardSpace);
    expect(errors.profileDescription).deep.equal(['Max length is 300']);
  });

  it('validates links', async function () {
    let subject = await getContainer().lookup('profile-validator');
    const cardSpace: Partial<Profile> = {
      id: '',
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
});
