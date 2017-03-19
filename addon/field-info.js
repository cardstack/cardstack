import Ember from 'ember';
const { guidFor } = Ember;

export default class FieldInfo {
  constructor(content, name, fields, firstNode, lastNode) {
    this.content = content;
    this.name = name;
    this.fields = fields;
    this.firstNode = firstNode;
    this.lastNode = lastNode;
    this.highlighted = false;
    this.opened = false;
  }

  get id() {
    if (!this._id) {
      // This gives us a stable key across rerenders.
      this._id = `${this.name}/${guidFor(this.content)}`;
    }
    return this._id;
  }

  copy() {
    let copied = new (this.constructor)(this.content, this.name, this.fields, this.firstNode, this.lastNode);
    copied._id = this._id;
    return copied;
  }

  range() {
    let r = new Range();
    r.setStartBefore(this.firstNode);
    r.setEndAfter(this.lastNode);
    return r;
  }

}
