import Component from '@glimmer/component';
import { type EmptyObject } from '@ember/component/helper';
import SortMenuItem, { Column, SortDirection } from './item';
import { htmlSafe } from '@ember/template';
import { SafeString } from '@ember/template/-private/handlebars';
import and from 'ember-truth-helpers/helpers/and';
import eq from 'ember-truth-helpers/helpers/eq';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';

import '@cardstack/boxel/styles/global.css';
import './index.css';

const MINIMUM_USEFUL_MAX_HEIGHT_PX = 150;
const VERTICAL_BUFFER_BELOW_MENU_PX = 40;
const FALLBACK_MAX_HEIGHT = '40vh';

interface Signature {
 Element: HTMLDivElement;
 Args: {
    maxHeight?: number;
    sortableColumns: Column[];
    sortedColumn: Column;
    sortedDirection: SortDirection;
    onSort: (column: Column, direction: SortDirection) => void;
 };
 Blocks: EmptyObject;
};

export default class SortMenuComponent extends Component<Signature> {
  get styleAttribute(): SafeString {
    return htmlSafe(`max-height: ${this.maxHeight}`);
  }

  get maxHeight(): string {
    let maxHeightArg = this.args.maxHeight;
    if (maxHeightArg && maxHeightArg > MINIMUM_USEFUL_MAX_HEIGHT_PX) {
      return `${maxHeightArg - VERTICAL_BUFFER_BELOW_MENU_PX}px`;
    }
    return FALLBACK_MAX_HEIGHT;
  }
  <template>
    <div class="boxel-sort-menu" style={{this.styleAttribute}} ...attributes>
      <header>Sort by</header>
      <ul role="menu">
        {{#each @sortableColumns as |column|}}
          <SortMenuItem
            @column={{column}}
            @direction="asc"
            @isSelected={{and (eq column @sortedColumn) (eq "asc" @sortedDirection)}}
            {{on "click" (fn @onSort column "asc")}}
          />
          <SortMenuItem
            @column={{column}}
            @direction="desc"
            @isSelected={{and (eq column @sortedColumn) (eq "desc" @sortedDirection)}}
            {{on "click" (fn @onSort column "desc")}}
          />
        {{/each}}
      </ul>
    </div>    
  </template>
}
