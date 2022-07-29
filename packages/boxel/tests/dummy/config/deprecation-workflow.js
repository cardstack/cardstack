/*global self */
self.deprecationWorkflow = self.deprecationWorkflow || {};
self.deprecationWorkflow.config = {
  throwOnUnhandled: true,
  workflow: [
    // We're unable eliminate ember-modifier deprecations completely due to the current state
    // of ember-power-select. However, the ember-modifier deprecations are for upgrading to
    // ember-modifier 4.0, not ember-source 4.0, so I think we are OK leaving those that we
    // can't fix for now.
    { handler: 'silence', matchId: 'ember-modifier.use-modify' },
    { handler: 'silence', matchId: 'ember-modifier.no-args-property' },
    { handler: 'silence', matchId: 'ember-modifier.no-element-property' },
  ],
};
