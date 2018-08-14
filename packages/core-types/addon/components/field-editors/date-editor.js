import { not } from '@ember/object/computed';
import Component from '@ember/component';
import layout from '../../templates/components/field-editors/date-editor';

export default Component.extend({
  layout,
  disabled: not('enabled')
});
