const crypto = require('crypto');
let key = crypto.randomBytes(32);
process.stdout.write(key.toString('base64'));
