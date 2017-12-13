import Component from 'ember-component';

import EditorH2 from '../templates/icons/editor/H2';
import EditorH3 from '../templates/icons/editor/H3';
import EditorList from '../templates/icons/editor/List';
import EditorNumberList from '../templates/icons/editor/number-list';
import EditorP from '../templates/icons/editor/P';
import EditorQuote from '../templates/icons/editor/Quote';

import EditorBold from '../templates/icons/editor/Bold';
import EditorSuperscript from '../templates/icons/editor/superscript';
import EditorSubscript from '../templates/icons/editor/subscript';
import EditorStrikethrough from '../templates/icons/editor/strikethrough';
import EditorItalic from '../templates/icons/editor/Italic';
import EditorLink from '../templates/icons/editor/Link';
import EditorUnderline from '../templates/icons/editor/Underline';

const icons = {
  'EditorH2' : EditorH2,
  'EditorH3' : EditorH3,
  'EditorList' : EditorList,
  'EditorNumberList' : EditorNumberList,
  'EditorP' : EditorP,
  'EditorQuote' : EditorQuote,

  'EditorBold' : EditorBold,
  'EditorSuperscript' : EditorSuperscript,
  'EditorSubscript' : EditorSubscript,
  'EditorStrikethrough' : EditorStrikethrough,
  'EditorItalic' : EditorItalic,
  'EditorLink' : EditorLink,
  'EditorUnderline' : EditorUnderline,
};

export default Component.extend({
  tagName: 'span',
  classNames: ['cs-icon'],
  classNameBindings: ['active'],
  active: false,
  didReceiveAttrs() {
    this.set('layout', icons[this.get('name')]);
  },
  click: function() {
    this.sendAction('iconClick', this.get('name'), this.get('params'));
  }
});
