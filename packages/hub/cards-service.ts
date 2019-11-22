export default class CardsService {

}

declare module "@cardstack/hub/dependency-injection" {
  interface KnownServices {
    "cards": CardsService;
  }
}
