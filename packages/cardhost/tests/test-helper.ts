import Application from 'cardhost/app';
import config from 'cardhost/config/environment';
import * as QUnit from 'qunit';
import { setApplication } from '@ember/test-helpers';
import { setup } from 'qunit-dom';
import { start } from 'ember-qunit';

setApplication(Application.create(config.APP));

setup(QUnit.assert);

declare global {
  interface Assert {
    includes(source: string | null, match: string, message?: string): void;
  }
}
QUnit.assert.includes = function (source, test, message = '') {
  let result = source?.includes(test) ?? false;
  let actual = source;
  let expected = test;
  this.pushResult({
    result,
    actual,
    expected,
    message,
  });
};

start();
