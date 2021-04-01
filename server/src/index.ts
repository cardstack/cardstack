import { createServer } from "./server.js";

const realms = Object.freeze({
  base: new URL("../../base-cards", import.meta.url).href,
});
let server = await createServer(realms);
server.listen(3000);
