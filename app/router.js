/* eslint-disable ember/routes-segments-snake-case */
import EmberRouterScroll from 'ember-router-scroll';
import config from './config/environment';

class Router extends EmberRouterScroll {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function () {
  this.route('about', function () {});
  this.route('docs', function () {});
  this.route('wave-player');
  this.route('scenarios', function () {
    this.route(
      'media-registry',
      { path: '/media-registry/:orgId', resetNamespace: true },
      function () {
        this.route(
          'collection',
          { path: '/collections/:collectionId' },
          function () {
            this.route('edit');
          }
        );

        this.route('item', { path: '/:itemId' }, function () {
          this.route('edit');
          this.route('musical-work');
        });
        this.route('products', function () {
          this.route('album', { path: '/:albumId' });
        });
        this.route('musical-works', function () {
          this.route('work', { path: '/:workId' });
          this.route('work-version', { path: '/:workId/:versionId' });
        });
        this.route('versions', { path: '/:itemId/versions' });
        this.route('version', { path: '/:itemId/:versionId' });
        this.route('discrepancies', function () {
          this.route('discrepancy', { path: '/:compId' }, function () {
            this.route('card', { path: '/:cardType/:cardId' }, function () {
              this.route('card', { path: '/:innerCardType/:innerCardId' });
            });
          });
        });
        this.route('agreements', { path: '/agreements/:agreementId' });
        this.route('cardflow');
      }
    );
    this.route('workflow', { resetNamespace: true }, function () {
      this.route('org', { path: '/:orgId' }, function () {
        this.route('thread', { path: '/:threadId' }, function () {
          this.route('tasks');
        });
      });
    });
    this.route('card-pay', { resetNamespace: true }, function () {
      this.route('workflow', { path: '/:workflowId' });
    });
  });
});

export default Router;
