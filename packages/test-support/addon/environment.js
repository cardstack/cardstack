// This is just a stub so that embroider doesn't get mad.
// This is overridden when the hub is started with the env var:
//   HUB_ENVIRONMENT=test
// In that scenario, @cardstack/test-support codegen emits a
// module that contains the ciSession which overrides this module.
export const ciSession = null;