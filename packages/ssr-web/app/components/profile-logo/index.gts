import Component from '@glimmer/component';
import { type EmptyObject } from '@ember/component/helper';
import firstChar from '../../helpers/first-char';
import cn from '@cardstack/boxel/helpers/cn';
import cssVar from '@cardstack/boxel/helpers/css-var';
import eq from 'ember-truth-helpers/helpers/eq';
import or from 'ember-truth-helpers/helpers/or';
import { capitalize } from '@ember/string';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    name: string;
    size?: string;
    logoBackground?: string;
    logoTextColor?: string;
  };
  Blocks: EmptyObject
}

export default class ProfileLogo extends Component<Signature> {

  <template>
    {{#let (firstChar @name) as |firstCharOfName|}}
      {{#if firstCharOfName}}
        <div
          class={{cn 'profile-logo' profile-logo--lg=(eq @size 'large')}}
          style={{
            cssVar
            profile-logo-background=(or @logoBackground 'var(--boxel-blue)')
            profile-logo-text-color=(or @logoTextColor 'var(--boxel-light)')
          }}
          data-test-profile-logo
          data-test-profile-logo-background={{@logoBackground}}
          data-test-profile-logo-text-color={{@logoTextColor}}
          ...attributes
        >
          {{capitalize firstCharOfName}}
        </div>
      {{/if}}
    {{/let}}
  </template>
}
