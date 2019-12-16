import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

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
    let cardMarkup = document.querySelector('.card-renderer-isolated--content');
    this.markup = cardMarkup ? cardMarkup.innerHTML.toString().trim() : '';
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
      return '60%';
    } else {
      return '100%';
    }
  }

  get height() {
    if (this.cssModeToggle.dockLocation === 'right') {
      return '100%';
    } else {
      return '40%';
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

  @action
  updateCode(code) {
    this.args.model.setIsolatedCss(code);
  }
}
