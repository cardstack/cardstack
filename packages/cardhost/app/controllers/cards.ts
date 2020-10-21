import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
//@ts-ignore
import ENV from '@cardstack/cardhost/config/environment';
import CssModeToggleService from '../services/css-mode-toggle';
import CardstackSessionService from '../services/cardstack-session';
import RouteInfoService from '../services/route-info';
import DraggableService from '../services/draggable';
import LibraryService from '../services/library';

const { animationSpeed, hideDialog } = ENV;
const duration = animationSpeed || 500;

export default class CardsController extends Controller {
  queryParams = ['confirmed'];
  @tracked confirmed: boolean | undefined;

  @service cssModeToggle!: CssModeToggleService;
  @service cardstackSession!: CardstackSessionService;
  @service routeInfo!: RouteInfoService;
  @service draggable!: DraggableService;
  @service library!: LibraryService;

  duration = duration;
  hideDialog = hideDialog || false;

  get currentCard() {
    let card;
    let route = (this.target as any).currentRoute as any; // unsure how to type this...
    while (route) {
      card = route.attributes && route.attributes.card;
      if (!card) {
        route = route.parent;
      } else {
        break;
      }
    }
    return card;
  }

  get themerClasses() {
    if (this.hasThemerTools) {
      return `editing-css themer-card-width--${this.cssModeToggle.width}`; // width is small, medium, or large
    } else {
      return '';
    }
  }

  get hasThemerTools() {
    return this.routeInfo.mode === 'themer' || this.routeInfo.mode === 'layout' || this.routeInfo.mode === 'preview';
  }

  get displayTopEdge() {
    return (
      this.routeInfo.mode === 'themer' ||
      this.routeInfo.mode === 'fields' ||
      this.routeInfo.mode === 'layout' ||
      this.routeInfo.mode === 'preview'
    );
  }

  get hideLeftEdge() {
    return this.routeInfo.mode === 'preview';
  }

  @action
  closeDialog() {
    this.confirmed = true;
  }
}
