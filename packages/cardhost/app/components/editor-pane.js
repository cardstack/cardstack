import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

export default class EditorPane extends Component {
  @service cssModeToggle;
  @tracked markup;
  @tracked css = this.args.model.isolatedCss;
  monacoKeyboardInstructions =
    'Once you focus on the editable code blocks, Tab becomes a tab character in the code. To escape Tab trapping, use Ctrl+M on Windows and Linux, or use Ctrl+Shift+M on OSX. Then the next Tab key will move focus out of the editor.';

  constructor() {
    super(...arguments);
    // getting markup must be done in the constuctor to guarantee that it
    // resolves before the code editor is rendered.
    this.markup = this.getCardMarkup();
  }

  get directions() {
    if (this.cssModeToggle.dockLocation === 'right') {
      return ['left'];
    } else {
      return ['top'];
    }
  }

  get cssEditorResizeDirections() {
    return ['bottom'];
  }

  get width() {
    if (this.cssModeToggle.dockLocation === 'right') {
      return 'calc(100% - var(--ch-card-size) - var(--ch-left-edge-navbar-width))';
    } else {
      return 'calc(100% - var(--ch-left-edge-navbar-width)';
    }
  }

  get height() {
    if (this.cssModeToggle.dockLocation === 'right') {
      return '100%';
    } else {
      return '40%';
    }
  }

  get maxWidth() {
    // the left edge is 80px wide. Do not allow dragging past the left edge.
    return document.body.clientWidth - 80;
  }

  get maxHeight() {
    // the top edge is 80px tall. Do not allow dragging past the top edge.
    if (this.cssModeToggle.dockLocation === 'right') {
      return '100%';
    } else {
      return document.body.clientHeight - 80;
    }
  }

  get classNames() {
    let classes = [];

    if (this.cssModeToggle.dockLocation === 'bottom') {
      classes.push('bottom-docked');
    } else {
      classes.push('right-docked');
    }

    if (this.cssModeToggle.visible === false) {
      classes.push('hidden');
    }

    return classes.join(' ');
  }

  getCardMarkup() {
    let cardMarkup = document.querySelector('.card-renderer-isolated--card-container');

    if (cardMarkup) {
      return cardMarkup.innerHTML
        .toString()
        .replace(/<!---->/gi, '')
        .trim();
    } else {
      return '';
    }
  }
}
