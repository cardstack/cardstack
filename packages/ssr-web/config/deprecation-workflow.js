/*global self */
self.deprecationWorkflow = self.deprecationWorkflow || {};
self.deprecationWorkflow.config = {
  throwOnUnhandled: true,
  workflow: [
    // Fastboot is still using inject: https://github.com/ember-fastboot/ember-cli-fastboot/blob/2a6ed5d76b00da2106a9ba10f048aa2bef989a80/packages/ember-cli-fastboot/fastboot/initializers/ajax.js#L33-L34
    { handler: 'log', matchId: 'remove-owner-inject' },
    { handler: 'log', matchId: 'ember-polyfills.deprecate-assign' },
  ],
};
