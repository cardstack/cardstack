import Component from '@glimmer/component';
import requirejsContext from 'requirejs-monaco-ember-polyfill';
import * as monaco from 'monaco-editor';
import { action } from '@ember/object';



export default class CodeEditor extends Component {
  @action
  renderEditor(el) {
    requirejsContext();
    monaco.editor.create(el, {
      value: this.args.code,
      language: this.args.language,
      theme: 'vs-dark',
      readOnly: true
    });
  }
}