import { moduleForComponent, test } from 'ember-qunit';
import { refreshCode } from '@cardstack/codegen';

moduleForComponent('models', 'Integration | CodeGen', {
  integration: true
});

test('finds hub-generated environment', function(assert) {
  let env = window.require('@cardstack/hub/environment');
  assert.ok(!!env, 'found hub environment');
});

test('can refresh hub-generated environment', function(assert) {
  let env = window.require('@cardstack/hub/environment');
  assert.ok(env.compiledAt, 'env should have compiledAt');
  return refreshCode('master').then(() => {
    let env2 = window.require('@cardstack/hub/environment');
    assert.ok(env2.compiledAt, 'env2 should have compiledAt');
    assert.ok(env.compiledAt !== env2.compiledAt, 'they should differ');
  });
});
