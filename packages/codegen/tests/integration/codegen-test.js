import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';

module('Integration | CodeGen', function(hooks) {
  setupTest(hooks);

  test('finds hub-generated environment', function(assert) {
    let env = window.require('@cardstack/plugin-utils/environment');
    assert.ok(!!env, 'found hub environment');
  });

  test('can refresh hub-generated environment', async function(assert) {
    let env = window.require('@cardstack/plugin-utils/environment');
    env.seenInCodeGenTest = true;
    await this.owner.lookup('service:cardstack-codegen').refreshCode();
    let env2 = window.require('@cardstack/plugin-utils/environment');
    assert.ok(!env2.seenInCodeGenTest, 'should have a refresh version of the module');
  });

});
