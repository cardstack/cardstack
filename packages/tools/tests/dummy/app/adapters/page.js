import AdapterMixin from 'ember-resource-metadata/adapter-mixin';
import Branchable from '@cardstack/tools/mixins/branch-adapter';
import DS from 'ember-data';

export default DS.JSONAPIAdapter.extend(AdapterMixin, Branchable, {
  namespace: 'cardstack/api'
});
