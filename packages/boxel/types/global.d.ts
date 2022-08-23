// Types for compiled templates
declare module '@cardstack/boxel/templates/*' {
  // prettier-ignore
  import { TemplateFactory } from 'htmlbars-inline-precompile';
  const tmpl: TemplateFactory;
  export default tmpl;
}

// Needed because `yarn prepack` was not recognising assert.dom
// and this fix caused other typing problems:
// https://github.com/simplabs/qunit-dom#typescript
import 'qunit-dom';

import '@glint/environment-ember-loose';

declare module '@glint/environment-ember-loose/registry' {
  import AndHelper from '@gavant/glint-template-types/types/ember-truth-helpers/and';
  import EqHelper from '@gavant/glint-template-types/types/ember-truth-helpers/eq';
  import OrHelper from '@gavant/glint-template-types/types/ember-truth-helpers/or';
  import NotHelper from '@gavant/glint-template-types/types/ember-truth-helpers/not';

  export default interface Registry {
    and: typeof AndHelper;
    eq: typeof EqHelper;
    or: typeof OrHelper;
    not: typeof NotHelper;
  }
}
