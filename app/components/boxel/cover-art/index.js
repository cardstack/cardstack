import Component from '@glimmer/component';

export default class extends Component {
  get size() {
    return this.args.size || 80;
  }
  get maxWidth() {
    return this.args.maxWidth || 190;
  }
  get numCovers() {
    return this.args.covers.length;
  }
}
