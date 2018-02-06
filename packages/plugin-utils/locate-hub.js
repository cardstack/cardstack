/*
  The @cardstack/hub ember-cli addon uses global coordination to
  ensure a single copy is in charge, even if it happens to get
  included multiple times.

  This utility is how other cardstack plugins should find it, if they
  need it.

  The hub registers itself during `init`. This function is valid at
  any later stage.
*/
module.exports = function() {
  let hub = global.__cardstack_hub_running_in_ember_cli;
  if (!hub) {
    // We want to catch the error case where somebody checked earlier
    // than they were supposed to and found no hub, only to miss it
    // later. By leaving this in place, if the hub tries to start up
    // after this point it will throw a helpful error.
    global.__cardstack_hub_running_in_ember_cli = { isLocatorDummy: true };
  }
  if (hub && !hub.isLocatorDummy) {
    return hub;
  }
};
