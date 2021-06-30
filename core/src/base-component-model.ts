export default class BaseComponentModel {
  constructor(private response: any) {}

  get data() {
    return {};
  }

  deserialize() {}
  serialize() {}
}
