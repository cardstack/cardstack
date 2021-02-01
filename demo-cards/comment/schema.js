// framework library code
import { field, belongsTo } from "@cardstack/types";

// base cards
import date from "hub:https://cardstack.com/base/date";
import mobiledoc from "hub:https://cardstack.com/base/mobiledoc";
import string from "hub:https://cardstack.com/base/string";

// my cards
import person from "../person";
import post from "../post";

export default class Comment {
  @field(mobiledoc)
  body;

  @field(date)
  published = Date.now();

  @belongsTo(person)
  author;

  @field(date)
  approvedAt;

  @belongsTo(post)
  post;
}
