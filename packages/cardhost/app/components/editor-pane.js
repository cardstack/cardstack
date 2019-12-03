import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class EditorPane extends Component {
  @service cssModeToggle;
  @tracked markup;
  @tracked css = this.args.model.isolatedCss;

  constructor() {
    super(...arguments)
    // getting markup must be done in the constuctor to guarantee that it
    // resolves before the code editor is rendered.
    let cardMarkup = document.querySelector('.card-renderer-isolated--content')
    this.markup = cardMarkup ? cardMarkup.innerHTML.toString().trim() : "";
  }

  @action
  preview() {
    var css = this.css
    let newStyle = document.createElement('style')
    newStyle.setAttribute('id', 'card-styles')

    document.querySelector('#card-styles').replaceWith(newStyle)

    newStyle.type = 'text/css';
    if (newStyle.styleSheet){
      // This is required for IE8 and below.
      newStyle.styleSheet.cssText = css;
    } else {
      newStyle.appendChild(document.createTextNode(css));
    }
  }

  @action
  updateCode(code) {
    this.css = code
    this.args.model.setIsolatedCss(code);
    this.preview()
  }
}