exports.grantAllPermissions = function(factory) {
  return factory.addResource('grants')
    .withAttributes({
      mayCreateResource: true,
      mayUpdateResource: true,
      mayDeleteResource: true
    });
};
