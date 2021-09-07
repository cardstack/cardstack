import Application from 'dummy/app';
import config from 'dummy/config/environment';
import * as QUnit from 'qunit';
import { setApplication } from '@ember/test-helpers';
import { setup } from 'qunit-dom';
import { start } from 'ember-qunit';
import { setRunOptions } from 'ember-a11y-testing/test-support';

setApplication(Application.create(config.APP));

setup(QUnit.assert);

// https://github.com/dequelabs/axe-core/issues/3082
// turn off the rule for aria-allowed-role for now until ember-a11y-testing is updated with bugfix from axe-core
setRunOptions({
  rules: {
    'aria-allowed-role': { enabled: false },
  },
});

start();
