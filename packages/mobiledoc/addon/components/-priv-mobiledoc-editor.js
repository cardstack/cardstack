import MobiledocEditor from 'ember-mobiledoc-editor/components/mobiledoc-editor/component';
import Range from 'mobiledoc-kit/utils/cursor/range';
import Ember from 'ember';

const { run } = Ember;
export const NEW_LINE_HREF = 'new-line';

export default MobiledocEditor.extend({
  init() {
    this._super();
    this._lastSelectionBounds = null;
    this._lastCursor = null;
  },

  didCreateEditor(editor) {
    this._super(editor);

    editor.cursorDidChange(() => {
      if (this.isDestroyed) { return; }

      run.join(() => {
        let bounds;
        if (editor.cursor.selection.rangeCount > 0) {
          bounds = editor.cursor.selection.getRangeAt(0).getBoundingClientRect();
        }


        let activeSection = editor.activeSection;

        this.sendAction('cursor-changed', {
          bounds,
          hasSelection: editor.cursor.hasSelection(),
          hasCursor: editor.cursor.hasCursor(),
          activeSection,
          activeSectionBounds: activeSection ? activeSection.renderNode._element.getBoundingClientRect() : null
        });
      });
    });

    editor.registerKeyCommand({
      str: 'backspace',
      run(editor) {
        if (editor.range.focusedPosition.section.type === 'list-item' &&
           editor.range.focusedPosition.section.prev &&
           editor.range.focusedPosition.offset === 0) {
          let prevSection = editor.range.focusedPosition.section.prev;
          let range = new Range(prevSection.headPosition(), prevSection.tailPosition());
          let markups = prevSection.markupsInRange(range);
          let markup = markups.find(item => {
            return item.attributes && item.attributes.href === NEW_LINE_HREF;
          });

          if (markup) {
            editor.run(postEditor => postEditor.toggleMarkup(markup, range));
          } else {
            return false;
          }
        } else {
          return false;
        }
      }
    });

    editor.registerKeyCommand({
      str: 'enter',
      run(editor) {
        let section = editor.range.focusedPosition.section;
        let range = new Range(section.headPosition(), section.tailPosition());
        let markups = section.markupsInRange(range);
        let markup = markups.find(item => {
          return item.attributes && item.attributes.href === NEW_LINE_HREF;
        });
        if (section.type === 'list-item' &&
           editor.range.focusedPosition.section.next &&
           !markup) {
          editor.run(postEditor => {
            let markup = postEditor.builder.createMarkup('a', { href: NEW_LINE_HREF });
            postEditor.insertTextWithMarkup(section.tailPosition(), String.fromCharCode(8203), [markup]);
          });
        } else {
          return false;
        }
      }
    });
  }
});
