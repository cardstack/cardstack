import Ember from 'ember';
const { scheduleOnce } = Ember.run;

export default Ember.Service.extend({
  // Can tools be enabled at all? This affects whether we will offer a
  // launcher button
  available: true,

  // Tools are active when the user has hit the launcher button and
  // revealed the toolbars.
  active: false,

  // Which tab are we showing in the toolbox?
  activePanel: 'cs-composition-panel',
  activePanelChoices: [
    {
      id: 'cs-composition-panel',
      icon: {
        name: 'write',
        width: 13,
        height: 18
      },
    },
    {
      id: 'cardstack-library',
      icon: {
        name: 'archive',
        width: 22,
        height: 24
      }
    }
  ],

  // Are we viewing the current URL as a normal page in its own right,
  // or in one of its other forms (like a preview card)?
  previewFormat: 'page',
  previewFormatChoices: [
    {
      id: 'page',
      description: 'Page',
      icon: {
        name: 'page',
        width: 18,
        height: 24
      }
    },
    {
      id: 'cards',
      description: 'Tile',
      icon: {
        name: 'tiles',
        width: 20,
        height: 24
      }
    }
  ],

  init() {
    this._super();
    let priorState;
    try {
      let item = localStorage.getItem('cardstack-tools');
      if (item) {
        priorState = JSON.parse(item);
        for (let key in priorState) {
          this.set(key, priorState[key]);
        }
      }
    } catch (err) {
      // Ignored
    }
    this.persistentState = priorState || {};
    this._fieldSources = Object.create(null);
    this._highlightedFieldId = null;
    this._contentSources = Object.create(null);
  },


  registerField(sourceId, field) {
    this._fieldSources[sourceId] = field;
    scheduleOnce('afterRender', this, this._handleFieldUpdates);
  },

  unregisterField(sourceId) {
    this._fieldSources[sourceId] = null;
    scheduleOnce('afterRender', this, this._handleFieldUpdates);
  },

  registerContent(sourceId, content) {
    this._contentSources[sourceId] = content;
    scheduleOnce('afterRender', this, this._handleFieldUpdates);
  },

  unregisterContent(sourceId) {
    this._contentSources[sourceId] = null;
    scheduleOnce('afterRender', this, this._handleFieldUpdates);
  },

  _handleFieldUpdates() {
    let sources = this._fieldSources;
    let fields = Object.create(null);
    for (let sourceId in sources) {
      let field = sources[sourceId];
      if (field) {
        fields[field.id] = field;
        field.highlight = this._highlightedFieldId === field.id;
      }
    }

    let contentSources = this._contentSources;
    let contents = Object.create(null);
    for (let sourceId in contentSources) {
      let contentInfo = contentSources[sourceId];
      if (contentInfo) {
        contents[contentInfo.id] = contentInfo;
      }
    }
    let contentItems = Object.keys(contents).map(id => contents[id]);

    this.set('fields', Object.keys(fields).map(id => fields[id]));
    this.set('contentItems', contentItems);

    // for now, we just treat the first piece of content in page
    // format as active. But we can extend this to make a particular
    // card active instead.
    this.set('activeContentItem', contentItems.find(item => item.format === 'page'));
  },

  _updatePersistent(key, value) {
    this.persistentState[key] = value;
    localStorage.setItem('cardstack-tools', JSON.stringify(this.persistentState));
    this.set(key, value);
  },

  setPreviewFormat(mode) {
    this._updatePersistent('previewFormat', mode);
  },

  setActive(isActive) {
    this._updatePersistent('active', isActive);
  },

  setActivePanel(which) {
    this._updatePersistent('activePanel', which);
  }

});
