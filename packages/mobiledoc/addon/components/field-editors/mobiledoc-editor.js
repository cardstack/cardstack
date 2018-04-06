import { computed } from '@ember/object';
import Component from '@ember/component';
import { capitalize } from '@ember/string';
import layout from '../../templates/components/field-editors/mobiledoc-editor';

export default Component.extend({
  layout,
  classNames: ['mobiledoc-overview'],
  sections: computed('mobiledoc', function() {
    let doc = this.get('mobiledoc');
    if (!doc) {
      return [];
    }
    return doc.sections.map(section => {
      switch (section[0]) {
      case 1:
        // Markup section
        {
          let tagName = section[1];
          return this.summaryForTag(tagName, section[2]);
        }
      case 3:
        {
          // List section
          let tagName = section[1];
          return this.summaryForTag(tagName, section[2]);
        }
      case 10:
        {
          // Card section
          let cardIndex = section[1];
          let card = doc.cards[cardIndex];
          let cardName = card[0];
          return this.summaryForCard(cardName);
        }
      }
    });
  }),
  summaryForTag(tag, markers) {
    switch (tag) {
    case 'p':
      try {
        return { text:  limitAtWordBoundary(markers[0][3], 40), class: "quotes-content" };
      } catch (err) {
        return { text: 'Paragraph' };
      }
    case 'h2':
      return { text: 'Headline' };
    case 'h3':
      return { text: 'Subheadline' };
    case 'ul':
      return 'List';
    case 'blockquote':
      return { text: 'Block Quote' };
    default:
      return { text: tag };
    }
  },
  summaryForCard(cardName) {
    return { text: capitalize(cardName.replace(/-card$/, '')) };
  }

});

function limitAtWordBoundary(string, charCount) {
  return string.slice(0, charCount).replace(/\W\w*$/, '') + "…";
}
