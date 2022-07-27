/*global self */
self.deprecationWorkflow = self.deprecationWorkflow || {};
self.deprecationWorkflow.config = {
  throwOnUnhandled: true,
  workflow: [
    { handler: 'throw', matchId: 'ember-global' },
    { handler: 'throw', matchId: 'ember-modifier.use-modify' },
    { handler: 'throw', matchId: 'ember-modifier.function-based-options' },
    { handler: 'throw', matchId: 'ember-modifier.no-args-property' },
    { handler: 'throw', matchId: 'ember-modifier.no-element-property' },
    { handler: 'throw', matchId: 'ensure-safe-component.string' },
    { handler: 'throw', matchId: 'this-property-fallback' },
  ],
};
