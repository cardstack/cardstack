import Component from '@glimmer/component';
import * as monaco from 'monaco-editor';


export default class CodeEditor extends Component {
  renderEditor() {
    monaco.editor.create(document.getElementById('m-container'), {
      value: [
        'function x() {',
        '\tconsole.log("Hello world!");',
        '}'
      ].join('\n'),
      language: 'javascript'
    });
  }
}