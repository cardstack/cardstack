import Priority from '@cardstack/models/generated/priority';
import { lt } from "@ember/object/computed";

export default Priority.extend({
  isUnhandled: lt('value', 20),
});
