import { field, belongsTo, hasMany, label } from "@cardstack/types";
import comment from "../comment";
import date from "hub:https://cardstack.com/base/date";
import mobiledoc from "hub:https://cardstack.com/base/mobiledoc";
import person from "../person";
import string from "hub:https://cardstack.com/base/string";

export default class Post {
  @field(string)
  title;

  @field(mobiledoc)
  body;

  @field(date)
  @label("Publication Date")
  published = Date.now();

  @belongsTo(person)
  author;

  @hasMany(comment)
  comments = {
    every: [
      {
        eq: {
          post: this,
        },
      },
      {
        notNull: ["approved"],
      },
    ],
  };
}
