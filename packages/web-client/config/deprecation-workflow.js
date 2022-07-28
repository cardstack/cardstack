/*global self */
self.deprecationWorkflow = self.deprecationWorkflow || {};
self.deprecationWorkflow.config = {
  throwOnUnhandled: true,
  workflow: [
    { handler: 'throw', matchId: 'routing.transition-methods' },
    { handler: 'throw', matchId: 'ember-modifier.use-destroyables' },
    { handler: 'throw', matchId: 'ember-modifier.function-based-options' },

    { handler: 'silence', matchId: 'ensure-safe-component.string' },
    { handler: 'silence', matchId: 'autotracking.mutation-after-consumption' },
    {
      handler: 'silence',
      matchId: 'argument-less-helper-paren-less-invocation',
    },
    {
      handler: 'silence',
      matchId: 'deprecated-run-loop-and-computed-dot-access',
    },

    // We're unable eliminate ember-modifier deprecations completely due to the current state
    // of ember-power-select. However, the ember-modifier deprecations are for upgrading to
    // ember-modifier 4.0, not ember-source 4.0, so I think we are OK leaving those that we
    // can't fix for now.
    { handler: 'silence', matchId: 'ember-modifier.no-element-property' },
    { handler: 'silence', matchId: 'ember-modifier.use-modify' },
    { handler: 'silence', matchId: 'ember-modifier.no-args-property' },
  ],
};
