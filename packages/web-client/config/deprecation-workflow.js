/*global self */
self.deprecationWorkflow = self.deprecationWorkflow || {};
self.deprecationWorkflow.config = {
  throwOnUnhandled: true,
  workflow: [
    {
      handler: 'silence',
      matchId: 'deprecated-run-loop-and-computed-dot-access',
    },
    {
      handler: 'silence',
      matchId: 'argument-less-helper-paren-less-invocation',
    },
    { handler: 'silence', matchId: 'ember-modifier.use-destroyables' },
    { handler: 'silence', matchId: 'ember-modifier.use-modify' },
    { handler: 'silence', matchId: 'ember-modifier.no-args-property' },
    { handler: 'silence', matchId: 'ember-modifier.no-element-property' },
    { handler: 'silence', matchId: 'ember-modifier.function-based-options' },
    { handler: 'silence', matchId: 'setting-on-hash' },
    { handler: 'silence', matchId: 'ensure-safe-component.string' },
    { handler: 'silence', matchId: 'autotracking.mutation-after-consumption' },
  ],
};
