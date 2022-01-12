import { execSync as exec } from 'child_process';
const [domainName, appName] = process.argv.slice(2);

const certificateArn = execute(
  `aws acm list-certificates | grep -C1 ${domainName} | grep CertificateArn | awk '{print $2}' | sed 's/[",]//g'`
);
const listenerArn = execute(
  `cat waypoint.hcl | grep listener_arn | grep "/${appName}/" | awk '{ print $3 }' | sed 's/"//g'`
);

// fixes this issue: https://github.com/hashicorp/waypoint/issues/1568
const fixCmd = `aws elbv2 modify-listener --listener-arn ${listenerArn} --protocol HTTPS --port 443 --certificates CertificateArn=${certificateArn} --output=table`;
execute(fixCmd, { env: { ...process.env, PAGER: '' } });

const listenerDetailsStr = execute(`aws elbv2 describe-listeners --listener-arns ${listenerArn}`);
console.log(`listener details: ${listenerDetailsStr}`);
const listenerDetails = JSON.parse(listenerDetailsStr);

const targetGroups = listenerDetails.Listeners[0].DefaultActions[0].ForwardConfig.TargetGroups;

// annoyingly waypoint is immediately setting traffic to 100% on the new target
// group _before_ it is healthy. so we switch the traffic to continue to flow to
// the old target group while the new one spins up
const oldTargetGroup = targetGroups.find((t) => t.Weight === 0).TargetGroupArn;
const newTargetGroup = targetGroups.find((t) => t.Weight === 100).TargetGroupArn;

// use the old target group while we wait for the new one to spin up
modifyTargetGroups(listenerArn, [
  { TargetGroupArn: oldTargetGroup, Weight: 100 },
  { TargetGroupArn: newTargetGroup, Weight: 0 },
]);

await waitForHealthy(newTargetGroup);

// switch to the new target group
modifyTargetGroups(listenerArn, [
  { TargetGroupArn: newTargetGroup, Weight: 100 },
  { TargetGroupArn: oldTargetGroup, Weight: 0 },
]);

async function waitForHealthy(targetGroupArn) {
  console.log(`waiting for healthy target group: ${targetGroupArn}`);
  let healthCheck;
  do {
    const healthCheckStr = execute(`aws elbv2 describe-target-health --target-group-arn ${targetGroupArn}`);
    console.log(`health check results: ${healthCheckStr}`);
    healthCheck = JSON.parse(healthCheckStr);
    await new Promise((res) => setTimeout(res, 1000));
  } while (!healthCheck.TargetHealthDescriptions.find((h) => h.TargetHealth.State === 'healthy'));
}

function modifyTargetGroups(listenerArn, targetGroups) {
  const command = `aws elbv2 modify-listener \
--listener-arn "${listenerArn}" \
--default-actions \
  '[{ \
      "Type": "forward", \
      "ForwardConfig": { \
        "TargetGroups": ${JSON.stringify(targetGroups)} \
      } \
   }]'`;
  execute(command);
}

function execute(command, options) {
  console.log(`executing: ${command}`);
  return exec(command, options ?? {})
    .toString()
    .trim();
}
