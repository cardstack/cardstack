import Controller from '@ember/controller';
import { action } from '@ember/object';

export default class DragDropController extends Controller {
  @action copyCard(/*card, opts*/) {
    this.set('draggedCard', true);
  }
}