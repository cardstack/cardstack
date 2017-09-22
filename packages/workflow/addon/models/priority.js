import Priority from '@cardstack/models/generated/priority';
import { computed } from "@ember/object";
import { lt } from "@ember/object/computed";

export default Priority.extend({
  isUnhandled: lt('value', 20),
  level: computed('value', function() {
    return this.get('value') < 20 ? 'high' : 'low';
  })
});
