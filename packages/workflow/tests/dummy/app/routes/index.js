import Ember from 'ember';
import {
  REQUEST_TO_PUBLISH_LIVE,
  READY_FOR_COPYEDITING,
  COURSE_INFORMATION_SYNCED
} from '@cardstack/workflow/services/cardstack-workflow';

export default Ember.Route.extend({
  model() {
    return [
      { tag: REQUEST_TO_PUBLISH_LIVE, isHandled: false },
      { tag: REQUEST_TO_PUBLISH_LIVE, isHandled: false },
      { tag: REQUEST_TO_PUBLISH_LIVE, isHandled: true },
      { tag: READY_FOR_COPYEDITING, isHandled: false },
      { tag: READY_FOR_COPYEDITING, isHandled: true },
      { tag: COURSE_INFORMATION_SYNCED, isHandled: true },
      { tag: COURSE_INFORMATION_SYNCED, isHandled: true },
    ]
  }
});
