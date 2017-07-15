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
  env.seenInCodeGenTest = true;
  return refreshCode('master').then(() => {
    let env2 = window.require('@cardstack/hub/environment');
    assert.ok(!env2.seenInCodeGenTest, 'should have a refresh version of the module');
  });
});
