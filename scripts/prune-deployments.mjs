import hcl from 'js-hcl-parser';
import fs from 'fs';
import { execSync } from 'child_process';

function execute(command, options) {
  return execSync(command, options ?? {})
    .toString()
    .trim();
}

function findCluster(waypointConfigFilePath, appName) {
  const waypointHcl = fs.readFileSync(waypointConfigFilePath, 'utf8');
  const waypointJson = hcl.parse(waypointHcl);
  const waypointConfig = JSON.parse(waypointJson);
  const waypointApp = waypointConfig.app.find((app) => Object.keys(app)[0] == appName);
  const cluster = waypointApp[appName][0].deploy[0].use[0]['aws-ecs'][0].cluster;
  return cluster;
}

function getServiceNameFromArn(serviceArn) {
  const arnPattern = /^.*\//g;
  return serviceArn.replace(arnPattern, '');
}

function getAppNameFromArn(serviceArn) {
  const arnPattern = /^.*\/(.*)-[^-]*$/;
  const matches = serviceArn.match(arnPattern);
  return matches[1];
}

function listServices(cluster, appName) {
  console.log(`-> Discovering services in cluster "${cluster}"`);

  let result = [];
  let nextToken = null;
  const serviceNameSuffixPattern = /-[^-]*$/;

  do {
    let responseJson;
    if (nextToken) {
      responseJson = execute(`aws ecs list-services --cluster ${cluster} --starting-token ${nextToken}`);
    } else {
      responseJson = execute(`aws ecs list-services --cluster ${cluster}`);
    }

    const response = JSON.parse(responseJson);
    const filtered = response.serviceArns.filter((arn) => getAppNameFromArn(arn) == appName);

    result = result.concat(filtered);
    nextToken = response.nextToken;
  } while (nextToken);

  return result;
}

function filterServices(serviceArns, appName, cluster) {
  console.log(`-> Looking for services without load balancer`);

  let result = [];
  for (let i = 0; i < serviceArns.length; i += 10) {
    const slicedServiceNames = serviceArns.slice(i, i + 10 > serviceArns.length ? serviceArns.length : i + 10);

    const servicesJson = execute(
      `aws ecs describe-services --cluster ${cluster} --services ${slicedServiceNames.join(' ')}`
    );
    const services = JSON.parse(servicesJson).services;

    const targetGroupArns = services.map((service) => service.loadBalancers[0].targetGroupArn);
    const targetGroupsJson = execute(
      `aws elbv2 describe-target-groups --target-group-arns ${targetGroupArns.join(' ')}`
    );
    const targetGroups = JSON.parse(targetGroupsJson).TargetGroups;

    const filteredTargetGroups = targetGroups
      .filter((tg) => tg.LoadBalancerArns.length == 0)
      .map((tg) => tg.TargetGroupArn);

    const filteredServices = services.filter((service) =>
      filteredTargetGroups.includes(service.loadBalancers[0].targetGroupArn)
    );

    result = result.concat(filteredServices);
  }
  return result;
}

function pruneServiceAndTargetGroup(service, cluster) {
  const serviceName = getServiceNameFromArn(service.serviceArn);
  console.log(`-> Pruning service ${serviceName}`);
  execute(`aws ecs delete-service --force --cluster ${cluster} --service ${service.serviceArn}`);
  console.log(`-> Finish pruning service ${serviceName}`);

  const targetGroupArn = service.loadBalancers[0].targetGroupArn;
  const targetGroupName = targetGroupArn.split('/')[1];
  console.log(`-> Pruning target group ${targetGroupName}`);
  execute(`aws elbv2 delete-target-group --target-group-arn ${service.loadBalancers[0].targetGroupArn}`);
  console.log(`-> Finish pruning target group ${targetGroupName}`);
}

function main() {
  console.log('\n» Pruning services and target groups...');

  const [appName, ...extraArgs] = process.argv.slice(2);
  const waypointConfigFilePath = extraArgs.length > 0 ? extraArgs[0] : 'waypoint.hcl';
  const cluster = findCluster(waypointConfigFilePath, appName);

  const serviceArns = listServices(cluster, appName);
  const services = filterServices(serviceArns, appName, cluster);

  try {
    services.forEach((service) => pruneServiceAndTargetGroup(service, cluster));
    console.log('-> Finish purging services and target groups');
  } catch (err) {
    console.error(err);
    throw err;
  }
}

main();
