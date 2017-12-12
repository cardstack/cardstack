import Component from 'ember-component';
import computed from 'ember-computed';
import { currentTransform } from '../lib/matrix';
import Range from 'mobiledoc-kit/utils/cursor/range';
import { containsNode } from 'mobiledoc-kit/utils/dom-utils';
import layout from '../templates/components/paragraph-options';
import { NEW_LINE_HREF } from './-priv-mobiledoc-editor';

export default Component.extend({
  layout,

  didReceiveAttrs() {
    let activeSection = this.get('cursor.activeSection');
    if (activeSection) {
      if (activeSection.tagName === 'li') {
        activeSection = activeSection.parent;
      }
      this.set('_lastActiveSection',  activeSection);
    }

    let element = this.get('element');
    let anchor = window.getSelection().anchorNode;
    this.set('weHaveSelection', element && anchor && containsNode(element, anchor));

    if (!this.get('weHaveSelection') && !this.get('cursor.hasSelection')) {
      this.set('linking', false);
    }

    if (this.get('cursor.hasSelection')) {
      // don't have both the paragraph-options and the block-menu open at once
      this.set('blockMenu', false);
    }
  },

  currentIcon: computed('cursor', function () {
    switch(this.get('_lastActiveSection.tagName')) {
    case 'blockquote':
      return 'EditorQuote';
    case 'p':
      return 'EditorP';
    case 'h2':
      return 'EditorH2';
    case 'h3':
      return 'EditorH3';
    case 'ul':
      return 'EditorList';
    case 'ol':
      return 'EditorNumberList';
    }
  }),

  didRender() {
    let rect = this.get('cursor.bounds');
    let para = this.$('.paragraph-options');
    if (this.get('cursor.hasSelection') && para.length > 0) {
      let my = para[0].getBoundingClientRect();
      let t = currentTransform(para);

      para.css({
        transform: `translateX(${rect.left - my.left + t.tx - my.width / 2 + rect.width / 2}px) translateY(${rect.top - my.top + t.ty - my.height - 10}px)`
      });


    }

    let section = this.get('_lastActiveSection.renderNode._element');
    if (section) {
      section = section.getBoundingClientRect();
    }
    let block = this.$('.block-control');
    if (section && block.length > 0) {
      let my = block[0].getBoundingClientRect();
      let t = currentTransform(block);
      block.css({
        transform: `translateX(${section.left - my.left + t.tx - 60}px) translateY(${section.top - my.top + t.ty}px)`
      });
    }
  },

  updateLinkMarkup() {
    let editor = this.get('editor.editor');
    let range = this.get('linking');
    if (!range) { return; }
    editor.run(postEditor => {

      let existingMarkup = editor.detectMarkupInRange(range, 'a');
      let isNewline = existingMarkup && existingMarkup.attributes && existingMarkup.attributes.href === NEW_LINE_HREF;
      if (existingMarkup && !isNewline) {
        postEditor.removeMarkupFromRange(range, existingMarkup);
      }

      let url = this.get('linkUrl');
      if (url && url.length > 0) {
        let attrs = { href: this.get('linkUrl') };
        if (this.get('isExternalLink')) {
          attrs.target = "_new";
        }

        let markup = postEditor.builder.createMarkup('a', attrs);
        postEditor.addMarkupToRange(range, markup);
      }
    });
  },

  actions: {
    toggleMenu() {
      this.set('blockMenu', !this.get('blockMenu'));
    },
    toggleSection(tag) {
      this.editor.editor.run(postEditor => {
        let range = new Range(this._lastActiveSection.headPosition(),this._lastActiveSection.tailPosition());
        postEditor.toggleSection(tag, range);
      });
      this.propertyDidChange('_lastActiveSection');
      this.send('toggleMenu');
    },
    toggleLink() {
      let editor = this.editor.editor;
      let range = editor.range;
      let headSection = range.head.section,
          tailSection = range.tail.section;
      if (!(headSection.isMarkerable && tailSection.isMarkerable)) {
        return;
      }
      let markup = editor.detectMarkupInRange(range, 'a');
      if (markup) {
        this.set('linkUrl', markup.attributes.href === NEW_LINE_HREF ? '' : markup.attributes.href);
        this.set('isExternalLink', markup.attributes.target === '_new');
      } else {
        this.set('linkUrl', '');
        this.set('isExternalLink', true);
      }
      this._ignoreCursorDidChange = true;
      this.set('linking', range);
    },
    setLinkExternal(isExternal) {
      if (this.get('isExternalLink') !== isExternal) {
        this.set('isExternalLink', isExternal);
        this.updateLinkMarkup();
      }
    },
    setLinkUrl(link) {
      if (this.get('linkUrl') !== link) {
        this.set('linkUrl', link);
        this.updateLinkMarkup();
      }
    }
  }
});
