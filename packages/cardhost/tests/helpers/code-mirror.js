export function setCodeMirrorValue(val) {
  let el = document.querySelector('.CodeMirror');
  el.CodeMirror.setValue(val);
}

export function getCodeMirrorValue() {
  let el = document.querySelector('.CodeMirror');
  return el.CodeMirror.getValue();
}