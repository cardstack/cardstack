import { SingleResourceDoc } from "jsonapi-typescript";

export default interface Card {
  realm: string;
  id: string;
  jsonapi: SingleResourceDoc;
}
