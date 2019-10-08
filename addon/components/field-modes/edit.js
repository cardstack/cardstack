import { tagName, layout as templateLayout } from '@ember-decorators/component';
import Component from '@ember/component';
import layout from '../../templates/components/field-modes/edit';
import fade from 'ember-animated/transitions/fade';

@templateLayout(layout)
@tagName('')
export default class FieldEditModeComponent extends Component {
  fade = fade;
}