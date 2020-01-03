import Component from '@glimmer/component';
import requirejsPolyfill from '@cardstack/requirejs-monaco-ember-polyfill';
import * as monaco from 'monaco-editor';
import { action } from '@ember/object';
import { restartableTask } from 'ember-concurrency-decorators';
import { timeout } from 'ember-concurrency';
import ENV from '@cardstack/cardhost/config/environment';

/**
 * Public API and usage documnentation for CodeEditor is in ui-components.hbs
 */

// without this polyfill, workers won't start due to a type error accessing
// a requirejs attribute. See the polyfill package readme for details.
requirejsPolyfill();

export default class CodeEditor extends Component {
  editor; // value is set by renderEditor
  editorIsReady = false; // set to true when the first code block renders

  get resizable() {
    return this.args.resizable === true ? true : false;
  }

  // Set default debounce in milliseconds.
  // This limits how often updateCode is called.
  get debounceMsForValidate() {
    let ms = this.args.debounceMsForValidate;
    return ms !== undefined ? this.args.debounceMsForValidate : 500;
  }

  // Sets default resize interval check in milliseconds.
  // This limits how often updatedDimensions is called.
  get resizeCheckIntervalMs() {
    return this.args.resizeCheckIntervalMs || 1000;
  }

  // readOnly defaults to true. Affects whether the editor lets you type in it
  get readOnly() {
    return this.args.readOnly === false ? false : true;
  }

  // validate defaults to returning true, if no validation function is provided
  // by the parent
  get validate() {
    return (
      this.args.validate ||
      function() {
        return true;
      }
    );
  }

  // If a parent component provided an updateCode action, use it.
  get updateCode() {
    return this.args.updateCode || function() {};
  }

  // applies the new dimensions using monaco APIs
  updateDimensions(opts) {
    this.editor.layout(opts);
  }

  // mostly used for testing
  @action
  editorReady() {
    if (!this.editorIsReady) {
      this.editorIsReady = true;
      if (this.args.editorReady) {
        this.args.editorReady();
      }
    }
  }

  @action
  renderEditor(el) {
    // Every time a new editor is created, this fires for the new editor
    // plus all existing editors on the page. If there are 4 editors on
    // the page, it will fire 1 + 2 + 3 + 4 times
    monaco.editor.onDidCreateEditor(this.editorReady);

    // el is the element that {{did-insert}} was used on.
    let codeModel = monaco.editor.createModel(this.args.code, this.args.language);

    // use calculated height for the ui-components page
    if (!this.resizable) {
      let height = codeModel.getLineCount() * 23;
      el.style.height = height.toString() + 'px';
    } else {
      el.style.height = '100%';
    }
    // `create` constructs a code editor and inserts it into the DOM
    let editor = monaco.editor.create(el, {
      model: codeModel,
      theme: 'vs-dark',
      readOnly: this.readOnly,
      minimap: { enabled: false },
      wordWrap: 'on',
      scrollBeyondLastLine: false,
      wrappingIndent: 'same',
    });

    // Whenever the code block's text changes, onUpdateCode will be called.
    editor.onDidChangeModelContent(this.onUpdateCode);

    // Save editor instance locally, so we can reference it in other methods
    this.editor = editor;

    // turn off resize in testing, otherwise it breaks acceptance tests
    if (this.resizable && ENV.environment !== 'test') {
      this.startResizeWatcher.perform(el);
    }
  }

  @action
  onUpdateCode() {
    // called whenever the code in the editor changes
    this.debounceAndUpdate.perform();
  }

  @restartableTask
  *debounceAndUpdate() {
    // This is a rate limiter so that fast typing doesn't wreck things.
    yield timeout(this.debounceMsForValidate);
    let code = this.editor.getValue(); // get the current text contents of the code editor
    if (this.validate(code)) {
      this.args.updateCode(code);
    }
  }

  @restartableTask
  *startResizeWatcher(wrapper) {
    // check container size and readjust code editor size responsively
    wrapper.style['padding-bottom'] = '2px';

    let { offsetWidth, offsetHeight } = wrapper;

    while (true) {
      yield timeout(this.resizeCheckIntervalMs);

      let { offsetWidth: newOffsetWidth, offsetHeight: newOffsetHeight } = wrapper;
      if (offsetHeight !== newOffsetHeight || offsetWidth !== newOffsetWidth) {
        offsetHeight = newOffsetHeight;
        offsetWidth = newOffsetWidth;
        let editorHeight = offsetHeight - 15; // So that the editor doesn't cover the resize corner
        this.updateDimensions({ height: editorHeight, width: offsetWidth });
      }
    }
  }
}
