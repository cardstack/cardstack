import type { TemplateOnlyComponent } from '@ember/component/template-only';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';
import eq from 'ember-truth-helpers/helpers/eq';
import cn from '@cardstack/boxel/helpers/cn';
import { type EmptyObject } from '@ember/component/helper';

export interface Column {
  name: string;
  sortType?: 'numeric'
}

export type SortDirection = 'asc' | 'desc';

interface Signature {
 Element: HTMLLIElement;
 Args: {
  isSelected: boolean;
  column: Column;
  direction: 'asc' | 'desc';
 };
 Blocks: EmptyObject;
};

const SortMenu: TemplateOnlyComponent<Signature> = <template>
  <li
    class={{cn "sort-menu-item" sort-menu-item__active=@isSelected}}
    role="menuitem"
    data-test-boxel-sort-menu-item-column={{@column.name}}
    data-test-boxel-sort-menu-item-direction={{@direction}}
    ...attributes
  >
    {{@column.name}}
    <span>
      {{#if (eq @column.sortType "numeric")}}
        {{#if (eq @direction "asc")}}
          1 {{svgJar "arrow-right"}} 9
        {{else}}
          9 {{svgJar "arrow-right"}} 1
        {{/if}}
      {{else}}
        {{#if (eq @direction "asc")}}
          A {{svgJar "arrow-right"}} Z
        {{else}}
          Z {{svgJar "arrow-right"}} A
        {{/if}}
      {{/if}}
    </span>
  </li>
</template>

export default SortMenu;

