import { main } from './main.js';

try {
  const [appName, ...extraArgs] = process.argv.slice(2);
  const waypointConfigFilePath = extraArgs.length > 0 ? extraArgs[0] : 'waypoint.hcl';

  const output = main(appName, waypointConfigFilePath);

  console.log({
    has_stopped_task: String(output.hasStoppedTask),
    stopped_reason: output.stoppedReason || '',
    logs_url: output.logsUrl || '',
  });
} catch (err) {
  console.error(err);
}
