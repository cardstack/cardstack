import Ember from 'ember';
import config from './config/environment';
import { cardstackRoutes } from '@cardstack/routing';

const Router = Ember.Router.extend({
  location: config.locationType,
  rootURL: config.rootURL
});

Router.map(cardstackRoutes);

export default Router;
