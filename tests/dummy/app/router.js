/* eslint-disable ember/routes-segments-snake-case */
import EmberRouterScroll from 'ember-router-scroll';
import config from './config/environment';

class Router extends EmberRouterScroll {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function() {
  this.route('media-registry', { path: '/:id' }, function() {
    this.route('edit');
    this.route('collection', { path: '/collection/:collectionId' }, function() {
      this.route('edit');
    });
    this.route('item', { path: '/:itemId' }, function() {
      this.route('edit');
      this.route('musical-work');
    });
    this.route('products', function() {
      this.route('album', { path: '/:albumId' });
    });
    this.route('versions', { path: '/:itemId/versions' });
    this.route('discrepancies', function() {
      this.route('discrepancy', { path: '/:compId' }, function() {
        this.route('card', { path: '/:cardType/:cardId' }, function() {
          this.route('card', { path: '/:innerCardType/:innerCardId' });
        });
      });
    });
    this.route('agreements');
    this.route('cardflow');
  });

  this.route('wave-player');
});

export default Router;
