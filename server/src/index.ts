import { createServer } from "./server.js";
import { join } from 'path';

const cardCacheDir = join(__dirname, "..", "..", "compiled");
const realms = Object.freeze({
  base: new URL("../../base-cards", import.meta.url).href,
});
let server = await createServer({ realms, cardCacheDir });
server.listen(3000);
