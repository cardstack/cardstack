import { main } from './main.js';

try {
  const [appName, ...extraArgs] = process.argv.slice(2);
  const waypointConfigFilePath = extraArgs.length > 0 ? extraArgs[0] : 'waypoint.hcl';
  main(appName, waypointConfigFilePath);
} catch (err) {
  console.error(err);
  throw err;
}
