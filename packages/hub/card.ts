import { SingleResourceDoc } from "jsonapi-typescript";
import { Realm } from "./realm";

export default interface Card {
  realm: Realm;
  id: string;
  jsonapi: SingleResourceDoc;
}

export interface CardId {
  realm: Realm;
  id: string;
}
