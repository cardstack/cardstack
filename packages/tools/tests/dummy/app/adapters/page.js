import Adapter from 'ember-resource-metadata/adapter';
import Branchable from '@cardstack/tools/mixins/branch-adapter';

export default Adapter.extend(Branchable, {
  host: 'http://localhost:3000'
});
