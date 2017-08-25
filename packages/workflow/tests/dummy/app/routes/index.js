import Ember from 'ember';
import {
  REQUEST_TO_PUBLISH_LIVE,
  READY_FOR_COPYEDITING,
  COURSE_INFORMATION_SYNCED
} from '@cardstack/workflow/services/cardstack-workflow';

export default Ember.Route.extend({
  model() {
    return [
      { category: REQUEST_TO_PUBLISH_LIVE, isHandled: false },
      { category: REQUEST_TO_PUBLISH_LIVE, isHandled: false },
      { category: REQUEST_TO_PUBLISH_LIVE, isHandled: true },
      { category: READY_FOR_COPYEDITING, isHandled: false },
      { category: READY_FOR_COPYEDITING, isHandled: true },
      { category: COURSE_INFORMATION_SYNCED, isHandled: true },
      { category: COURSE_INFORMATION_SYNCED, isHandled: true },
    ]
  }
});
