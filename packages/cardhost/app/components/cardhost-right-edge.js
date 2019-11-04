import Component from '@glimmer/component';

const typeToInputTypeMap = {
  '@cardstack/core-types::string': 'Text Field',
  '@cardstack/core-types::case-insensitive': 'Text Field',
  '@cardstack/core-types::boolean': 'Checkbox',
  '@cardstack/core-types::date': 'Date',
  '@cardstack/core-types::integer': 'Text Field',
  '@cardstack/core-types::belongs-to': 'Dropdown',
}

export default class CardhostRightEdge extends Component {
  get sectionTitle() {
    return typeToInputTypeMap[this.args.selectedField.type] || 'Text Field';
  }
}