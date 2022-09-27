import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelCardContainer from '../card-container';
import BoxelCardPicker, { PickableCard } from './index';
import BoxelHeader from '../header';

import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { A } from '@ember/array';
import { fn } from '@ember/helper';

const CARDS = [
  {
    id: 'pia-midina',
    type: 'participant',
    name: 'Pia Midina',
    description: 'Recording artist & lyricist',
  },
  {
    id: 'jenny-sparks',
    type: 'participant',
    name: 'Jenny Sparks',
    description: 'Background singer',
  },
  {
    id: 'francesco-midina',
    type: 'participant',
    name: 'Francesco Midina',
    description: 'Producer (Francesco Rocks)',
    disabled: true,
  },
  {
    id: 'joel-kaplan',
    type: 'participant',
    name: 'Joel Kaplan',
    description: 'Mastering engineer',
    disabled: true,
  },
  {
    id: 'mariah-solis',
    type: 'participant',
    name: 'Mariah Solis',
    description: 'Mixing engineer',
  },
] as PickableCard[];

export default class CardPickerUsage extends Component {
  @tracked cards = A(CARDS);
  @tracked selectedItem: PickableCard | undefined;

  @action chooseItem(c: PickableCard): void {
    this.selectedItem = c;
  }
  <template>
    <FreestyleUsage @name="CardPicker">
      <:example>
        <BoxelCardPicker
          @items={{this.cards}}
          @chooseItem={{this.chooseItem}}
          @selectedItem={{this.selectedItem}}
        as |item|>
          <BoxelCardContainer @displayBoundaries={{true}}>
            <BoxelHeader @header={{item.type}} />
            <div>{{item.name}}</div>
            {{item.description}}
          </BoxelCardContainer>
        </BoxelCardPicker>
      </:example>
      <:api as |Args|>
        <Args.Array
          @name="items"
          @type="Object"
          @description="Array of objects"
          @items={{this.cards}}
          @onChange={{fn (mut this.cards)}}
          @jsonCollapseDepth={{0}}
        />
        <Args.Object
          @name="selectedItem"
          @description="The item that is currently selected"
          @value={{this.selectedItem}}
          @jsonCollapseDepth={{0}}
          @defaultValue="null"
        />
        <Args.Action
          @name="chooseItem"
          @description="Function to call when an item is selected from the dropdown"
        />
      </:api>
    </FreestyleUsage>
  </template>
}
