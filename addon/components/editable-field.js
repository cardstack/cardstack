import Component from '@ember/component';
import template from '../templates/components/editable-field';
import { layout, tagName } from '@ember-decorators/component';
import fade from 'ember-animated/transitions/fade';

@layout(template)
@tagName('')
export default class EditableFieldComponent extends Component {
  fade = fade;
}
