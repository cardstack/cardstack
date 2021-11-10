import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
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
}
