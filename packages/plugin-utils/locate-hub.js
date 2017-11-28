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
    throw new Error("Unable to locate @cardstack/hub addon.");
  }
  return hub;
};
