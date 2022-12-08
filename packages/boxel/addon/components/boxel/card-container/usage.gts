import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelCardContainer from './index';
import BoxelHeader from '../header';
import { fn } from '@ember/helper';

export default class CardContainerUsage extends Component {
  @tracked displayBoundaries = true;
  @tracked isHighlighted = false;

  <template>
    {{!-- template-lint-disable no-inline-styles --}}
    <FreestyleUsage @name="CardContainer">
      <:description>
        A wrapper container for a card.
      </:description>
      <:example>
        <BoxelCardContainer
          @displayBoundaries={{this.displayBoundaries}}
          @isHighlighted={{this.isHighlighted}}
        >
          {{!-- Usage with BoxelHeader component --}}
          <BoxelHeader
            @header="Card"
            @isHighlighted={{this.isHighlighted}}
          />
          <div>Card Here</div>
        </BoxelCardContainer>
      </:example>
      <:api as |Args|>
        <Args.Bool
          @name="displayBoundaries"
          @description="(styling) Displays card boundary"
          @defaultValue={{false}}
          @value={{this.displayBoundaries}}
          @onInput={{fn (mut this.displayBoundaries)}}
        />
        <Args.Bool
          @name="isHighlighted"
          @description="(styling) Highlights card boundary"
          @defaultValue={{false}}
          @value={{this.isHighlighted}}
          @onInput={{fn (mut this.isHighlighted)}}
        />
        <Args.Yield
          @description="Unstyled area for custom card content and fields"
        />
      </:api>
    </FreestyleUsage>

    <FreestyleUsage @name="CardContainer layout example">
      <:example>
        <BoxelCardContainer @displayBoundaries={{true}}>
          <div style="display:grid; grid-template-rows: 5rem;">
            <div style="margin: auto">
              One strategy to consider is using a root element with <code>display: grid</code> to layout the contents of your card.
            </div>
          </div>
        </BoxelCardContainer>
      </:example>
    </FreestyleUsage>
  </template>
}
