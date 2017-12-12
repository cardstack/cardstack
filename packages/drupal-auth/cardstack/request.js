const https = require('https');

module.exports = function httpsRequest(options, data) {
  return new Promise((resolve,reject) => {
    let ghReq = https.request(options, (ghRes) => {
      let body = '';
      ghRes.setEncoding('utf8');
      ghRes.on('data', chunk => body += chunk);
      ghRes.on('end', () => {
        resolve({ response: ghRes, body: JSON.parse(body) });
      });
    });
    ghReq.on('error', reject);
    if (data) {
      ghReq.write(data);
    }
    ghReq.end();
  });
};
