import DS from 'ember-data';
import AdapterMixin from 'ember-resource-metadata/adapter-mixin';

// TODO: tools is not a good place for this, probably moves into here,
// and we can drop the dependency
import Branchable from '@cardstack/tools/mixins/branch-adapter';

export default DS.JSONAPIAdapter.extend(AdapterMixin, Branchable, {
  namespace: 'cardstack'
});
