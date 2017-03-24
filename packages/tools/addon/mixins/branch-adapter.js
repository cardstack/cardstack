import Ember from 'ember';

/*
  Overall data flow:

  - buildURL can discover the desired branch by parsing the id (for an
    explicitly requested version) or by looking at a service (for the
    current prevailing default branch). It sets the branch param in
    the URL.

  - handleResponse moves the branch value into the response-level
    metadata. It will be seen there by our serializer.

*/

export default Ember.Mixin.create({
  //branchModels: Ember.inject.service('-cs-branch-models'),

  buildURL(modelName, id, snapshot, requestType, query) {
    let branch = 'draft';
    let result = this._super(modelName, id, snapshot, requestType, query);
    result += `?branch=${branch}`;
    return result;
  },

  handleResponse(status, headers, payload, requestData) {
    // our build includes a polyfill for window.URL as needed
    let url = new URL(requestData.url);
    let branch = url.searchParams.get('branch');
    if (branch) {
      if (!payload.meta) {
        payload.meta = {};
      }
      payload.meta.branch = branch;
    }
    return this._super(status, headers, payload, requestData);
  }
});
