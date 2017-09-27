import Priority from '@cardstack/models/generated/priority';
import { computed } from "@ember/object";

export default Priority.extend({
  level: computed('value', function() {
    return this.get('value') < 20 ? 'high' : 'low';
  })
});
