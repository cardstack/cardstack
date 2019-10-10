/* eslint-env node */
/* global Promise */

const child_process = require('child_process');

function runDocker(...args) {
  let result = child_process.spawnSync("docker", args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`Docker died running ${args.join(' ')}: ${result.stderr}`);
  }
  return result.stdout;
}

function getServiceId() {
  let result = runDocker('stack', 'services', 'hub', '--filter', 'name=hub', '--format', '{{.ID}}');
  return result.split("\n")[0];
}

function safeGet(obj, ...paths) {
  while (paths.length > 0 && obj) {
    obj = obj[paths.shift()];
  }
  return obj;
}

function inspectService(serviceId) {
  let result = runDocker('inspect', serviceId, '--format', '{{json .}}');
  let doc = JSON.parse(result);
  let label = safeGet(doc, 'Spec', 'Labels', 'cardstack_travis_build');
  let status = safeGet(doc, 'UpdateStatus', 'State');
  return { label, status };
}

async function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  let targetLabel = process.argv[2];
  if (!targetLabel) {
    process.stderr.write("You must pass the desired label as an argument\n");
    process.exit(-1);
  }
  let serviceId = getServiceId();

  let startTime = Date.now();
  for (;;) {
    let { label } = inspectService(serviceId);
    if (label === targetLabel) {
      break;
    }
    process.stdout.write(`Still waiting to see ${targetLabel}\n`);
    if (Date.now() - startTime > 120000) {
      process.stderr.write("More than 150 seconds elapsed and we never saw our new label\n");
      process.exit(-1);
    }
    await timeout(1000);
  }

  startTime = Date.now();
  for (;;) {
    let { label, status } = inspectService(serviceId);
    if (label !== targetLabel) {
      process.stderr.write(`Docker probably rolled back, our label disappeared. label=${label} status=${status}\n`);
      process.exit(-1);
    }
    if (!status) {
      process.stdout.write("No update was required, we're done\n");
      return;
    }

    // rollback is considered success here because we're looking at
    // our own label, meaning it rolled back *to us*.
    if (status === 'completed' || status === 'rollback_completed') {
      process.stdout.write(`Update succeeded, status=${status}\n`);
      return;
    }
    if (Date.now() - startTime > 300000) {
      process.stderr.write("More than 5 minutes elapsed and our deploy didn't finish. status=${status}\n");
      process.exit(-1);
    }
    process.stdout.write(`Waiting. status=${status}\n`);
    await timeout(5000);
  }


}

main().catch(err => {
  process.stderr.write(err.stack || err);
  process.exit(-1);
});
