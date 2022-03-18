// Types for compiled templates
declare module '@cardstack/boxel/templates/*' {
  import { TemplateFactory } from 'htmlbars-inline-precompile';
  const tmpl: TemplateFactory;
  export default tmpl;
}

// Needed because `yarn prepack` was not recognising assert.dom
// and this fix caused other typing problems:
// https://github.com/simplabs/qunit-dom#typescript
import 'qunit-dom';
