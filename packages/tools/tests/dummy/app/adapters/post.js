import AdapterMixin from 'ember-resource-metadata/adapter-mixin';
import DS from 'ember-data';
export default DS.JSONAPIAdapter.extend(AdapterMixin, {
  namespace: 'cardstack/api'
});
