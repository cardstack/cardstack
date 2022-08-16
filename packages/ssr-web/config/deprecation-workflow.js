/*global self */
self.deprecationWorkflow = self.deprecationWorkflow || {};
self.deprecationWorkflow.config = {
  throwOnUnhandled: true,
  workflow: [{ handler: 'log', matchId: 'ember-polyfills.deprecate-assign' }],
};
