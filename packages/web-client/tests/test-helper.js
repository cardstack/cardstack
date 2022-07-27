import Application from '@cardstack/web-client/app';
import config from '@cardstack/web-client/config/environment';
import * as QUnit from 'qunit';
import { setApplication, visit } from '@ember/test-helpers';
import { setup } from 'qunit-dom';
import { start } from 'ember-qunit';
import setupSinon from 'ember-sinon-qunit';

setApplication(Application.create(config.APP));

setup(QUnit.assert);

setupSinon();

start();

// This bypasses a long-standing bug in tests where a first call to visit() with
// query parameters fails: https://github.com/emberjs/ember.js/issues/17118
export async function visitWithQueryFix(url) {
  await visit('/');
  await visit(url);
}
