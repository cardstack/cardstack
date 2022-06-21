const core = require('@actions/core');
const { main } = require('./main');

try {
  const appName = core.getInput('app');
  const waypointConfigFilePath = core.getInput('waypoint_hcl_path');

  const output = main(appName, waypointConfigFilePath);

  core.setOutput('has_stopped_task', String(output.hasStoppedTask));
  core.setOutput('stopped_reason', output.stoppedReason || '');
  core.setOutput('logs_url', output.logsUrl || '');
} catch (err) {
  core.setFailed(err.message);
  throw err;
}
