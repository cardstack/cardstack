import DS from 'ember-data';
import Branchable from '@cardstack/tools/mixins/branch-adapter';

export default DS.JSONAPIAdapter.extend(Branchable, {
  host: 'http://localhost:3000'
});
