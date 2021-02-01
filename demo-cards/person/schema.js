import { field } from "@cardstack/types";
import mobiledoc from "hub:https://cardstack.com/base/mobiledoc";
import string from "hub:https://cardstack.com/base/string";

export default class Person {
  @field(string)
  name;

  @field(mobiledoc)
  bio;
}
