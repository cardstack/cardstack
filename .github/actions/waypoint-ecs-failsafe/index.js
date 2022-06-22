const core = require('@actions/core');
const { main } = require('./main');

try {
  const appName = core.getInput('app');
  const waypointConfigFilePath = core.getInput('waypoint_hcl_path');
  main(appName, waypointConfigFilePath);
} catch (err) {
  core.setFailed(err.message);
  throw err;
}
