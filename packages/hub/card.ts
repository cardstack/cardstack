import { SingleResourceDoc } from "jsonapi-typescript";

export default interface Card {
  realm: string;
  id: string;
  asJSONAPI(): SingleResourceDoc;
}
