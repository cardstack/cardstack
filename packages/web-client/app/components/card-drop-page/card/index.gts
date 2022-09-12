import Component from '@glimmer/component';
import { type EmptyObject } from '@ember/component/helper';
import BoxelButton from '@cardstack/boxel/components/boxel/button';
import BoxelCardContainer from '@cardstack/boxel/components/boxel/card-container';

interface Signature {
  Element: HTMLElement;
  Args: EmptyObject;
  Blocks: {
    default: [];
    heading: [];
    explanation: [];
    action: [];
  } 
}

export default class CardDropPageCard extends Component<Signature> {
  <template>
    <BoxelCardContainer class='card-drop-page-card' ...attributes>
      <div class='card-drop-page-card__section'>
        {{yield}}

        <h3 class='card-drop-page-card__heading'>
          {{yield to='heading'}}
        </h3>

        <p class='card-drop-page-card__explanation'>
          {{yield to='explanation'}}
        </p>

        {{#if (has-block 'action')}}
          {{yield to='action'}}
        {{else}}
          <BoxelButton
            @as='anchor'
            href='https://cardstack.com'
            target='_blank'
            rel='noopener'
          >
            Visit Cardstack.com
          </BoxelButton>
        {{/if}}
      </div>
    </BoxelCardContainer>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'CardDropPage::Card': typeof CardDropPageCard;
  }
}
