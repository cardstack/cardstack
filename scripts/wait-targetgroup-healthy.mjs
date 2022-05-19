import { execSync as exec } from 'child_process';

const [
  appName
] = process.argv.slice(2);

function execute(command, options) {
  return exec(command, options ?? {})
    .toString()
    .trim();
}

const loadBalancerName = `waypoint-ecs-${appName}`;
const loadBalancersJson = execute(`aws elbv2 describe-load-balancers --names ${loadBalancerName}`);
const loadBalancerArn = JSON.parse(loadBalancersJson).LoadBalancers[0].LoadBalancerArn;
console.log(`load balancer for ${appName}: ${loadBalancerArn}`)

const listenersJson = execute(`aws elbv2 describe-listeners --load-balancer-arn ${loadBalancerArn}`);
const listener = JSON.parse(listenersJson).Listeners.find((listener) => listener.Port === 443);
console.log(`listener for port 443: ${listener.ListenerArn}`);

const targetGroupArn = listener.DefaultActions[0].ForwardConfig.TargetGroups.find((targetGroup) => targetGroup.Weight === 0).TargetGroupArn;
const targetGroupJson = execute(`aws elbv2 describe-target-groups --target-group-arns ${targetGroupArn}`);
const targetGroup = JSON.parse(targetGroupJson).TargetGroups[0];
const targetGroupName = targetGroup.TargetGroupName;

console.log(`checking target health: ${targetGroupName}`);
while(true) {
  const healthCheckJson = execute(`aws elbv2 describe-target-health --target-group-arn ${targetGroupArn}`);
  const healthCheck = JSON.parse(healthCheckJson);


  const targetHealthStates = healthCheck.TargetHealthDescriptions.map((target) => target.TargetHealth.State)

  if (healthCheck.TargetHealthDescriptions.length <= 0) {
    console.log("no targets in target group")
  } else if (targetHealthStates.includes('healthy')) {
    console.log(`targetgroup is now healthy`)
    break;
  } else if (targetHealthStates.includes('unhealthy')) {
    const count = targetHealthStates.filter((target) => target === 'unhealthy').length;
    throw `${count} target(s) are unhealthy`;
  } else if (targetHealthStates.includes('initial')) {
    const count = targetHealthStates.filter((target) => target === 'initial').length;
    console.log(`${count} target(s) are initializing`);
  } else {
    throw 'unexpected health state'
  }

  await new Promise((res) => setTimeout(res, 1000));
}
