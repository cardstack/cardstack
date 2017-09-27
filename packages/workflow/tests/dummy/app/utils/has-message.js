import { computed } from '@ember/object';

export default function hasMessage(type) {
  return computed(function() {
    let messages = this.get('store').peekAll('message');
    return messages.find((message) => {
      return message.get('cardId') === this.get('id') &&
        message.get('cardType') === type;
    });
  });
}
