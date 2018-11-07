import EmberRouter from '@ember/routing/router';
import config from './config/environment';
import { cardstackRoutes } from '@cardstack/routing';

const Router = EmberRouter.extend({
  location: config.locationType,
  rootURL: config.rootURL
});

Router.map(cardstackRoutes);

export default Router;
