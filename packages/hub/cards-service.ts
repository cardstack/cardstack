import { SingleResourceDoc } from "jsonapi-typescript";
import Session from "./session";
import Card from "./card";

export default class CardsService {
  async create(_session: Session, realm: string, doc: SingleResourceDoc): Promise<Card> {
    return {
      realm,
      id: String(Math.floor(Math.random()*1000)),
      jsonapi: doc,
    };
  }
}

declare module "@cardstack/hub/dependency-injection" {
  interface KnownServices {
    "cards": CardsService;
  }
}
