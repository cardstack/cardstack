import Component from "@ember/component";
import { liveQuery } from "@cardstack/live-queries";

export default Component.extend({
  items: liveQuery(function() {
    return {
      type: "item",
      query: {}
    };
  })
});
