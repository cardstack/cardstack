import { TestEnv, createTestEnv } from './helpers';
import { testCard } from './test-card';
import { myOrigin } from '../origin';
import { ScopedCardService } from '../cards-service';
import { Session } from '../session';
import { ModuleService } from '../module-service';
import { tmpdir } from 'os';
import { join } from 'path';
import { remove } from 'fs-extra';

describe('module-service', function() {
  let env: TestEnv, cards: ScopedCardService, modules: ModuleService;

  beforeEach(async function() {
    process.env.CARD_FILES_CACHE = join(tmpdir(), `cardstack-module-service-tests-${Math.floor(Math.random() * 1000)}`);
    env = await createTestEnv();
    cards = (await env.container.lookup('cards')).as(Session.INTERNAL_PRIVILEGED);
    modules = await env.container.lookup('modules');
  });

  afterEach(async function() {
    await env.destroy();
    await remove(process.env.CARD_FILES_CACHE as string);
  });

  it('can access a feature that is a default export within the card', async function() {
    let sampleValidator = `module.exports = function isValid(value){ return value === 42; }`;
    let card = await cards.create(
      `${myOrigin}/api/realms/first-ephemeral-realm`,
      testCard().withAttributes({
        csFiles: { 'validate.js': sampleValidator },
      }).jsonapi
    );
    let validate = await modules.load(card, 'validate.js', 'default');
    expect(validate).is.ok;
    expect(validate(42)).to.equal(true);
    expect(validate(41)).to.equal(false);
  });

  it('can access a feature that is a named export within the card', async function() {
    let sampleValidator = `exports.v = function isValid(value){ return value === 42; }`;
    let card = await cards.create(
      `${myOrigin}/api/realms/first-ephemeral-realm`,
      testCard().withAttributes({
        csFiles: { 'validate.js': sampleValidator },
      }).jsonapi
    );
    let validate = await modules.load(card, 'validate.js', 'v');
    expect(validate).is.ok;
    expect(validate(42)).to.equal(true);
    expect(validate(41)).to.equal(false);
  });

  it('can access a feature that is within a subdirectory within the card', async function() {
    let sampleValidator = `exports.v = function isValid(value){ return value === 42; }`;
    let card = await cards.create(
      `${myOrigin}/api/realms/first-ephemeral-realm`,
      testCard().withAttributes({
        csFiles: {
          lib: { 'validate.js': sampleValidator },
        },
      }).jsonapi
    );
    let validate = await modules.load(card, 'lib/validate.js', 'v');
    expect(validate).is.ok;
    expect(validate(42)).to.equal(true);
    expect(validate(41)).to.equal(false);
  });

  it('allows feature code to import other files within card', async function() {
    let sampleValidator = `let other = require('./other');
       module.exports = function isValid(value){ return value === other(); }
     `;
    let other = `module.exports = function(){ return 'the-value'; }`;
    let card = await cards.create(
      `${myOrigin}/api/realms/first-ephemeral-realm`,
      testCard().withAttributes({
        csFiles: {
          'validate.js': sampleValidator,
          'other.js': other,
        },
      }).jsonapi
    );
    let validate = await modules.load(card, 'validate.js', 'default');
    expect(validate).is.ok;
    expect(await validate('the-value', undefined as any)).to.equal(true);
    expect(await validate(41, undefined as any)).to.equal(false);
  });

  it('allows feature code to import from hub peerDependency', async function() {
    let sampleValidator = `const CardstackError = require('@cardstack/hub/error').default;
       module.exports = function shouldThrow(value){ throw new CardstackError('it worked', { title: 'it worked', status: 654 }) }
     `;
    let card = await cards.create(
      `${myOrigin}/api/realms/first-ephemeral-realm`,
      testCard().withAttributes({
        csPeerDependencies: {
          '@cardstack/hub': '*',
        },
        csFiles: {
          'validate.js': sampleValidator,
        },
      }).jsonapi
    );
    let validate = await modules.load(card, 'validate.js', 'default');
    expect(validate).is.ok;
    try {
      await validate('anything', undefined as any);
      throw new Error(`should never get here`);
    } catch (err) {
      expect(err.status).to.equal(654);
    }
  });

  it.skip('handles invalid JS inside the card', async function() {});
  it.skip('handles a slash in filename in csFiles', async function() {});
  it.skip('handles non-object directory within csFiles', async function() {});
});
