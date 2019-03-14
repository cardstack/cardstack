import Component from '@ember/component';
import { inject as service } from '@ember/service';
import layout from '../templates/components/cs-mobiledoc-card';
import { defaultBranch } from '@cardstack/plugin-utils/environment';

export default Component.extend({
  layout,
  tagName: '',
  cardstackData: service(),

  async init() {
    this._super(...arguments);
    let { card: { type, id } } = this.get('payload') || { card: {} }; // this is the mobiledoc card, not to be confused with the cardstack card
    // TODO need to get the branch context for this mobiledoc card, maybe it's available from query params?
    let branch = defaultBranch;

    // Need to defer Fastboot rendering here?
    let card = await this.get('cardstackData').load(type, id, 'embedded', { branch });
    this.set('card', card);
  },

  actions: {
    setCursor(evt) {
      // When the mobiledoc card is in edit mode, we'll need to steal all the clicks so that
      // we can move the content editable cursor around in a predicable fashion. Cards that need click events
      // should only expect to receive them when the mobiledoc is not in editable mode.
      if (!this.env.isInEditor || evt.target.className.includes('cs-mobiledoc-card--caption-input')) { return; }

      // When a user clicks on the card, we'll position the cursor after the card for easy editing
      this.editor.selectRange(this.postModel.tailPosition());
    },
    setCaption(caption) {
      let payload = this.get('payload');
      payload.caption = caption;

      this.get('saveCard')(payload, false);
    }
  }
});
