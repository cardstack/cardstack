import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class EditorPane extends Component {
  @service cssModeToggle;
  @tracked markup;
  @tracked css = this.args.model.isolatedCss;

  constructor() {
    super(...arguments);
    // getting markup must be done in the constuctor to guarantee that it
    // resolves before the code editor is rendered.
    let cardMarkup = document.querySelector('.card-renderer-isolated--content');
    this.markup = cardMarkup ? cardMarkup.innerHTML.toString().trim() : '';
  }

  @action
  updateCode(code) {
    this.args.model.setIsolatedCss(code);
  }
}
