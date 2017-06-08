import DS from 'ember-data';
import AdapterMixin from 'ember-resource-metadata/adapter-mixin';
import Branchable from '@cardstack/tools/mixins/branch-adapter';

export default DS.JSONAPIAdapter.extend(AdapterMixin, Branchable);
