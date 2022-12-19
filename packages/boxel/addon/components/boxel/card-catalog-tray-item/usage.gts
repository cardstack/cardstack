import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelCardCatalogTrayItem from './index';
import BoxelSearchbox from '../searchbox';
import { action } from '@ember/object';
import { array, fn } from '@ember/helper';
import { on } from '@ember/modifier';
import { tracked } from '@glimmer/tracking';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';
import './usage.css';

interface ExampleItem {
  state: string | null;
  icon: string;
  title: string;
  description: string;
}

export default class CardCatalogTrayItemUsage extends Component {
  @tracked title = 'Title';
  @tracked description = 'A description';
  @tracked icon = 'gear';
  @tracked used = false;
  @tracked state = null;

  /* dragging example start */
  @tracked dragExampleState: string | null = null;

  @action onDragStart(e: DragEvent): void {
    // copy the item that is hidden far far away and set it as the drag image
    // note, opacity is an issue that needs a workaround: https://stackoverflow.com/questions/9712535/html5-drag-and-drop-no-transparency
    let draggedItem: HTMLElement | null =
      document.querySelector('.very-far-away');
    if (draggedItem) {
      e.dataTransfer?.setDragImage(draggedItem, 280, 40);
      this.dragExampleState = 'dragged-in-tray';
    }
  }
  @action onDragEnd(): void {
    this.dragExampleState = null;
  }
  /* dragging example end */

  /* tray example start */
  @tracked filter = '';
  items = [
    {
      state: null,
      icon: 'eye',
      title: 'Premium content',
      description:
        'Content in this area is only visible to your paying supporters',
    },
    {
      state: 'used',
      icon: 'gear',
      title: 'Second item',
      description:
        'A used item. This should appear darker and with a check mark on the right.',
    },
    {
      state: null,
      icon: 'gear',
      title: 'Third item',
      description: 'Unused item',
    },
  ] as ExampleItem[];

  get filteredItems(): ExampleItem[] {
    if (!this.filter) {
      return this.items;
    } else {
      const lowercaseFilter = this.filter.toLowerCase();
      const hasFilter = (item: ExampleItem) => {
        return (
          item.title.toLowerCase().indexOf(lowercaseFilter) !== -1 ||
          item.description.toLowerCase().indexOf(lowercaseFilter) !== -1
        );
      };
      return this.items.filter((item) => hasFilter(item));
    }
  }

  @action onSearchboxInput(e: InputEvent): void {
    let target = e.target as HTMLInputElement;
    this.filter = target.value;
  }
  /* tray example end */

  <template>
    <FreestyleUsage @name="CardCatalogTrayItem">
      <:example>
        <BoxelCardCatalogTrayItem
          @title={{this.title}}
          @description={{this.description}}
          @icon={{this.icon}}
          @state={{this.state}}
        />
      </:example>
      <:api as |Args|>
        <Args.String
          @name="state"
          @description="State of the tray item, controls its visual styles."
          @value={{this.state}}
          @options={{array null "dragged-item" "dragged-in-tray" "used"}}
          @onInput={{fn (mut this.state)}}
        />
        <Args.String
          @name="title"
          @value={{this.title}}
          @onInput={{fn (mut this.title)}}
        />
        <Args.String
          @name="description"
          @value={{this.description}}
          @onInput={{fn (mut this.description)}}
        />
        <Args.String
          @name="icon"
          @description="Icon on the left of the item. Argument is passed to svg-jar"
          @value={{this.icon}}
          @onInput={{fn (mut this.icon)}}
        />
      </:api>
    </FreestyleUsage>

    <FreestyleUsage @name="dragging example">
        {{!--
          note - drop shadow does not actually follow this in the example.
          right now the browser has control over styles of the drag image
        --}}
      <:example>
        <BoxelCardCatalogTrayItem
          draggable="true"
          @title="Drag me"
          @description="Some content"
          @icon="gear"
          @state={{this.dragExampleState}}
          {{on "dragstart" this.onDragStart}}
          {{on "dragend" this.onDragEnd}}
        />
        <BoxelCardCatalogTrayItem
          class="very-far-away"
          @title="Drag me"
          @description="Some content"
          @icon="gear"
          @state="dragged-item"
        />
      </:example>
    </FreestyleUsage>

    <FreestyleUsage @name="Usage in tray">
      <:example>
        <div class="boxel-card-catalog-tray-example">
          <header class="boxel-card-catalog-tray-example__header-container">
            <h4 class="boxel-card-catalog-tray-example__header-title">
              {{svgJar
                "card-catalog"
                class="boxel-card-catalog-tray-example__header-icon"
              }}
              Card Catalog
            </h4>
            <BoxelSearchbox
              @placeholder="Search"
              @label="Search for cards to use"
              @id="card-catalog-tray-search"
              @value={{this.filter}}
              @onInput={{this.onSearchboxInput}}
              class="boxel-card-catalog-tray-example__header-search"
            />
            {{! https://www.htmhell.dev/20-close-buttons/#solution-4-a-button-with-hidden-text-and-only-visually-accessible-icon }}
            <button
              class="boxel-card-catalog-tray-example__close-button"
              type="button"
              aria-label="Close"
            >
              {{svgJar "close" width="100%" height="100%" aria-hidden="true"}}
            </button>
          </header>
          <div class="boxel-card-catalog-tray-example__list-container" tabindex="0">
            <ul class="boxel-card-catalog-tray-example__list">
              {{#each this.filteredItems as |item|}}
              <li>
                <BoxelCardCatalogTrayItem
                  @state={{item.state}}
                  @icon={{item.icon}}
                  @title={{item.title}}
                  @description={{item.description}}
                />
                </li>
              {{/each}}
            </ul>
          </div>
        </div>
      </:example>
    </FreestyleUsage>
  </template>
}
