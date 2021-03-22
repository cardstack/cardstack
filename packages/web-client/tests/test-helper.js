import Application from '@cardstack/web-client/app';
import config from '@cardstack/web-client/config/environment';
import { setApplication } from '@ember/test-helpers';
import { start } from 'ember-qunit';

setApplication(Application.create(config.APP));

start();
