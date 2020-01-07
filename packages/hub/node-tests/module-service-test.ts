import { TestEnv, createTestEnv } from './helpers';
import { testCard } from './test-card';
import { myOrigin } from '../origin';
import { ScopedCardService } from '../cards-service';
import { Session } from '../session';

describe('module-service', function() {
  let env: TestEnv, cards: ScopedCardService;

  beforeEach(async function() {
    env = await createTestEnv();
    cards = (await env.container.lookup('cards')).as(Session.INTERNAL_PRIVILEGED);
  });

  afterEach(async function() {
    await env.destroy();
  });

  it('can access a feature that is a default export within the card', async function() {
    let sampleValidator = `module.exports = function isValid(value){ return value === 42; }`;
    let card = await cards.create(
      `${myOrigin}/api/realms/first-ephemeral-realm`,
      testCard().withAttributes({
        csFeatures: { 'field-validate': 'validate.js' },
        csFiles: { 'validate.js': sampleValidator },
      }).jsonapi
    );
    let validate = await card.loadFeature('field-validate');
    expect(validate).is.ok;
    if (validate) {
      expect(await validate(42, undefined as any)).to.equal(true);
      expect(await validate(41, undefined as any)).to.equal(false);
    }
  });

  it('can access a feature that is a named export within the card', async function() {
    let sampleValidator = `exports.v = function isValid(value){ return value === 42; }`;
    let card = await cards.create(
      `${myOrigin}/api/realms/first-ephemeral-realm`,
      testCard().withAttributes({
        csFeatures: { 'field-validate': ['validate.js', 'v'] },
        csFiles: { 'validate.js': sampleValidator },
      }).jsonapi
    );
    let validate = await card.loadFeature('field-validate');
    expect(validate).is.ok;
    if (validate) {
      expect(await validate(42, undefined as any)).to.equal(true);
      expect(await validate(41, undefined as any)).to.equal(false);
    }
  });

  it('can access a feature that is within a subdirectory within the card', async function() {
    let sampleValidator = `exports.v = function isValid(value){ return value === 42; }`;
    let card = await cards.create(
      `${myOrigin}/api/realms/first-ephemeral-realm`,
      testCard().withAttributes({
        csFeatures: { 'field-validate': ['lib/validate.js', 'v'] },
        csFiles: {
          lib: { 'validate.js': sampleValidator },
        },
      }).jsonapi
    );
    let validate = await card.loadFeature('field-validate');
    expect(validate).is.ok;
    if (validate) {
      expect(await validate(42, undefined as any)).to.equal(true);
      expect(await validate(41, undefined as any)).to.equal(false);
    }
  });

  it('allows feature code to import other files within card', async function() {
    let sampleValidator = `let other = require('./other');
       module.exports = function isValid(value){ return value === other(); }
     `;
    let other = `module.exports = function(){ return 'the-value'; }`;
    let card = await cards.create(
      `${myOrigin}/api/realms/first-ephemeral-realm`,
      testCard().withAttributes({
        csFeatures: { 'field-validate': 'validate.js' },
        csFiles: {
          'validate.js': sampleValidator,
          'other.js': other,
        },
      }).jsonapi
    );
    let validate = await card.loadFeature('field-validate');
    expect(validate).is.ok;
    if (validate) {
      expect(await validate('the-value', undefined as any)).to.equal(true);
      expect(await validate(41, undefined as any)).to.equal(false);
    }
  });

  it('allows feature code to import from hub peerDependency', async function() {
    let sampleValidator = `const CardstackError = require('@cardstack/hub/error').default;
       module.exports = function shouldThrow(value){ throw new CardstackError('it worked', { title: 'it worked', status: 654 }) }
     `;
    let card = await cards.create(
      `${myOrigin}/api/realms/first-ephemeral-realm`,
      testCard().withAttributes({
        csFeatures: { 'field-validate': 'validate.js' },
        csPeerDependencies: {
          '@cardstack/hub': '*',
        },
        csFiles: {
          'validate.js': sampleValidator,
        },
      }).jsonapi
    );
    let validate = await card.loadFeature('field-validate');
    expect(validate).is.ok;
    if (validate) {
      try {
        await validate('anything', undefined as any);
        throw new Error(`should never get here`);
      } catch (err) {
        expect(err.status).to.equal(654);
      }
    }
  });
});
