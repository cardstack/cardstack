import Ember from 'ember';
const { guidFor } = Ember;

export default class FieldInfo {
  constructor(content, name, fields, firstNode, lastNode) {
    this.content = content;
    this.name = name;
    this.fields = fields;
    this.firstNode = firstNode;
    this.lastNode = lastNode;

    // This gives us a stable key across rerenders.
    this.id = `${name}/${guidFor(content)}`;

    // this property is controlled by the cardstack-tools service
    this.highlight = false;
  }
}
