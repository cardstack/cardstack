import Component from '@glimmer/component';
import { type EmptyObject } from '@ember/component/helper';
import cn from '@cardstack/boxel/helpers/cn';
import eq from 'ember-truth-helpers/helpers/eq';
import ProfileLogo from '../profile-logo';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    name: string;
    size?: string;
    logoBackground?: string;
    logoTextColor?: string;
    address?: string;
    text?: string;
    vertical?: boolean;
  };
  Blocks: EmptyObject
}

export default class Profile extends Component<Signature> {

  <template>
    <div
      class={{cn 'profile' profile--vertical=@vertical}}
      data-test-profile={{@name}}
      ...attributes
    >
      <ProfileLogo
        class='profile__logo'
        @name={{@name}}
        @size={{@size}}
        @logoBackground={{@logoBackground}}
        @logoTextColor={{@logoTextColor}}
      />
      <div>
        <div
          class={{cn 'profile__name' profile__name--lg=(eq @size 'large')}}
          title={{@name}}
          data-test-profile-name
        >
          {{@name}}
        </div>
        {{#if @address}}
          <div class='profile__address'>
            {{@address}}
          </div>
        {{/if}}
        {{#if @text}}
          <div class='profile__text' data-test-profile-text>
            {{@text}}
          </div>
        {{/if}}
      </div>
    </div>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Profile': typeof Profile;
  }
}
