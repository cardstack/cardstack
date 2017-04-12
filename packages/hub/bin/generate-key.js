const crypto = require('crypto');
let key = crypto.randomBytes(32);
process.stdout.write(`CARDSTACK_SESSIONS_KEY=${key.toString('base64')}\n`);
