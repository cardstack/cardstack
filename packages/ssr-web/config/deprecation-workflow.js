/*global self */
self.deprecationWorkflow = self.deprecationWorkflow || {};
self.deprecationWorkflow.config = {
  workflow: [
    { handler: 'silence', matchId: 'ember-source.deprecation-without-for' },
    { handler: 'silence', matchId: 'ember-source.deprecation-without-since' },
    { handler: 'silence', matchId: 'ember-keyboard.first-responder-inputs' },
    {
      handler: 'silence',
      matchId: 'ember-keyboard.keyboard-first-responder-on-focus-mixin',
    },
    { handler: 'silence', matchId: 'ember-keyboard.ember-keyboard-mixin' },
  ],
};
