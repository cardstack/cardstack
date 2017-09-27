import { assert } from "@ember/debug"
import Message from '@cardstack/models/generated/message';
import { equal } from '@ember/object/computed';
// import { workflowGroupId } from '@cardstack/workflow/helpers/workflow-group-id';

import { task } from 'ember-concurrency';
import { computed } from "@ember/object"

export default Message.extend({
	loadedCard: computed({
		get() {
			this.get('_loadCard').perform();
			return null;
		},
		set(k, v) {
			return v;
		}
  }),

  handle() {
    this.set('status', 'handled');
  },

  isUnhandled: equal('status', 'unhandled'),

	_loadCard: task(function * () {
		let cardType = this.get('_cardTypeInStore');
		let card = yield this.get('store').findRecord(cardType, this.get('cardId'));
		this.set('loadedCard', card);
	}),

	//TODO: Replace this make-shift singularization
	_cardTypeInStore: computed('cardType', function() {
		let cardType = this.get('cardType');
		assert(`${cardType} doesn't seem to be a plural noun`, cardType.charAt(cardType.length - 1) === 's');
		return this.get('cardType').replace(/s$/, '');
	})
	/*
	groupId: Ember.computed('priority.id', 'tag', function() {
		return workflowGroupId([this.get('priority.id'), this.get('tag')]);
	}),

	isHandled: Ember.computed('status', function() {
		return this.get('status') !== 'pending';
	}),

	isImportant: Ember.computed('status', 'priority', function() {
		let status = this.get('status');
		let priority = this.get('priority');
		if (status === 'pending') {
			return [NEED_RESPONSE, DELEGATED].includes(priority);
		} else {
			return [PROCESSED, FYI].includes(priority);
		}
	})
	*/
})
