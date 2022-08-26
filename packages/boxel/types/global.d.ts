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
  import GtHelper from '@gavant/glint-template-types/types/ember-truth-helpers/gt';
  import { OptionalHelper } from 'ember-composable-helpers';
  import { ComponentLike, HelperLike } from '@glint/template';
  import { svgJar } from '@cardstack/boxel/utils/svg-jar';
  import cssVar from '@cardstack/boxel/helpers/css-var';
  import { EmptyObject } from '@ember/component/helper';

  export default interface Registry {
    and: typeof AndHelper;
    eq: typeof EqHelper;
    or: typeof OrHelper;
    not: typeof NotHelper;
    gt: typeof GtHelper;
    optional: typeof OptionalHelper;
    cn: HelperLike<{
      Args: { Positional: string[]; Named: Record<string, string | boolean> };
      Return: string;
    }>;
    'on-key': HelperLike<{
      Args: {
        Positional: [keyCombo: string, () => void];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Named: { event: any };
      };
      Return: void;
    }>;
    'set-body-class': HelperLike<{
      Args: { Positional: string[] };
      Return: void;
    }>;
    'css-var': typeof cssVar;
    'svg-jar': typeof svgJar;
    'unique-id': HelperLike<{ Args: EmptyObject; Return: string }>;

    'Freestyle::Usage': ComponentLike<{
      Element: HTMLDivElement;
      Args: {
        name: string;
        description: string;
      };
      Blocks: {
        example: [];
        api: [];
        description: [];
      };
    }>;
  }
}
