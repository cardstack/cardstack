import { execSync as exec } from 'child_process';
const [appName] = process.argv.slice(2);

/* 
  Finds ELB TargetGroups that are associated (by name) with the given app
  and are not associated with any load balancers and deletes them.
*/
const targetGroupsStr = execute(`aws elbv2 describe-target-groups`);
const targetGroups = JSON.parse(targetGroupsStr).TargetGroups;
const nameRegex = new RegExp(`^${appName}-[0-9A-Z]+$`);
const targetGroupsToRemove = targetGroups.filter((t) => {
  return t.LoadBalancerArns.length === 0 && t.TargetGroupName.match(nameRegex);
});
for (const tg of targetGroupsToRemove) {
  execute(`aws elbv2 delete-target-group --target-group-arn ${tg.TargetGroupArn}`);
}

function execute(command, options) {
  console.log(`executing: ${command}`);
  return exec(command, options ?? {})
    .toString()
    .trim();
}
