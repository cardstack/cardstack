import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { fieldTypeMappings, fieldComponents } from '@cardstack/core/utils/mappings';

export default class CardhostTopEdgeComponent extends Component {
  fieldTypeMappings = fieldTypeMappings;
  fieldComponents = fieldComponents;

  @service cardstackSession;
  @service edges;
  @tracked isExpanded = false;

  @action
  toggleMenuExpand() {
    this.isExpanded = !this.isExpanded;
  }

  @service router;

  @action
  logout(sessionLogout) {
    sessionLogout();
    let cardId = this.router.currentRoute.parent.params.name;
    if (cardId) {
      this.router.transitionTo('cards.card.view', cardId);
    } else {
      this.router.transitionTo('index');
    }
  }

  @action
  closeLeftEdge() {
    this.isExpanded = false;
  }

  /*
    closeListener, registerCloseListener, and destroyCloseListener are the
    actions responsible for closing the left edge when you click somewhere
    outside of it. They are only registered when the left edge is open,
    and torn down when it is closed via the did-insert and will-destroy
    render modifiers.
  */
  @action
  closeListener(event) {
    let thisElement = document.querySelector('#cardhost-left-edge');
    if (thisElement && !thisElement.contains(event.target)) {
      this.closeLeftEdge();
    }
  }

  @action
  registerCloseListener() {
    document.querySelector('body').addEventListener('click', this.closeListener);
    document.querySelector('body').addEventListener('focusin', this.closeListener);
  }

  @action
  destroyCloseListener() {
    document.querySelector('body').removeEventListener('click', this.closeListener);
    document.querySelector('body').removeEventListener('focusin', this.closeListener);
  }

  @action
  initDrag() {
    this.isDragging = true;
  }

  @action startDragging(field, evt) {
    evt.dataTransfer.setData('text', evt.target.id);
    evt.dataTransfer.setData('text/type', field.type);
  }
}
