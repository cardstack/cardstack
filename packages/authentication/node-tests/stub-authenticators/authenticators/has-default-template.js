exports.authenticate = async function(payload /*, userSearcher */) {
  return payload;
};

exports.defaultUserTemplate = '{ "id": "{{upstreamId}}", "type": "users" }';
