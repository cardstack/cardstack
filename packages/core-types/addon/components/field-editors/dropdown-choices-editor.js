import layout from '../../templates/components/field-editors/dropdown-choices-editor';
import DropdownBaseEditor from './dropdown-base-editor';

export default DropdownBaseEditor.extend({
  layout,

  init() {
    this._super();

    this.get('loadOptions').perform();
  }
});
