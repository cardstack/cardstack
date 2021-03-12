import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class CardCatalogTrayItemUsage extends Component {
  @tracked title = 'Title';
  @tracked description = 'A description';
  @tracked icon = 'gear';
  @tracked used = false;
  @tracked state = null;

  /* dragging example start */
  @tracked dragExampleState = null;

  @action onDragStart(e) {
    // copy the item that is hidden far far away and set it as the drag image
    // note, opacity is an issue that needs a workaround: https://stackoverflow.com/questions/9712535/html5-drag-and-drop-no-transparency
    const draggedItem = document.querySelector('.very-far-away');
    e.dataTransfer.setDragImage(draggedItem, 280, 40);

    this.dragExampleState = 'dragged-in-tray';
  }
  @action onDragEnd() {
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
  ];

  get filteredItems() {
    if (!this.filter) {
      return this.items;
    } else {
      const lowercaseFilter = this.filter.toLowerCase();
      const hasFilter = (item) => {
        return (
          item.title.toLowerCase().indexOf(lowercaseFilter) !== -1 ||
          item.description.toLowerCase().indexOf(lowercaseFilter) !== -1
        );
      };
      return this.items.filter((item) => hasFilter(item));
    }
  }

  @action onSearchboxInput(e) {
    this.filter = e.target.value;
  }
  /* tray example end */
}
