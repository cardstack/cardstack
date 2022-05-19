import { execSync as exec } from 'child_process';

const [
  appName
] = process.argv.slice(2);

function execute(command, options) {
  return exec(command, options ?? {})
    .toString()
    .trim();
}

setTimeout(() => {
  console.error('timeout after 5 minutes');
  process.exit(1);
}, 5 * 60 * 1000);

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
let lastMessage
while(true) {
  const healthCheckJson = execute(`aws elbv2 describe-target-health --target-group-arn ${targetGroupArn}`);
  const healthCheck = JSON.parse(healthCheckJson);

  const targetHealthStates = healthCheck.TargetHealthDescriptions.map((target) => target.TargetHealth.State)

  if (targetHealthStates.length === 0) {
    const message = "no targets in target group"
    if (message !== lastMessage) {
      console.log(message);
      lastMessage = message;
    }
  } else if (targetHealthStates.includes('healthy')) {
    console.log(`targetgroup is now healthy`)
    break;
  } else if (targetHealthStates.includes('unhealthy')) {
    const count = targetHealthStates.filter((target) => target === 'unhealthy').length;
    throw `${count} target(s) unhealthy`;
  } else if (targetHealthStates.includes('initial')) {
    const count = targetHealthStates.filter((target) => target === 'initial').length;
    const message = `${count} target(s) initializing`;
    if (message !== lastMessage) {
      console.log(message);
      lastMessage = message;
    }
  } else if (targetHealthStates.length > 0) {
    throw 'unexpected health state'
  }

  await new Promise((res) => setTimeout(res, 1000));
}
