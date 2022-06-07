const core = require('@actions/core');
const hcl = require('js-hcl-parser');
const fs = require('fs');
const { execSync } = require('child_process');

function execute(command, options) {
  return execSync(command, options ?? {})
    .toString()
    .trim();
}

function getAppConfig(waypointConfigFilePath, appName) {
  const waypointHcl = fs.readFileSync(waypointConfigFilePath, 'utf8');
  const waypointJson = hcl.parse(waypointHcl);
  const waypointConfig = JSON.parse(waypointJson);
  const waypointApp = waypointConfig.app.find((app) => Object.keys(app)[0] === appName);
  const cluster = waypointApp[appName][0].deploy[0].use[0]['aws-ecs'][0].cluster;
  const disableAlb = waypointApp[appName][0].deploy[0].use[0]['aws-ecs'][0].disable_alb ?? false;

  return { cluster, disableAlb };
}

function getServiceNameFromArn(serviceArn) {
  const arnPattern = /^.*\//g;
  return serviceArn.replace(arnPattern, '');
}

function getAppNameFromServiceArn(serviceArn) {
  const arnPattern = /^.*\/(.*)-[^-]*$/;
  const matches = serviceArn.match(arnPattern);
  return matches && matches.length > 1 ? matches[1] : '';
}

function getAppNameFromTargetGroupName(targetGroupName) {
  const namePattern = /^(.*)-[^-]+$/;
  const matches = targetGroupName.match(namePattern);
  return matches && matches.length > 1 ? matches[1] : '';
}

function getServices(cluster, appName) {
  console.log(`-> Discovering services in cluster "${cluster}"`);

  let serviceArns = [];
  let nextToken = null;
  do {
    let responseJson;
    if (nextToken) {
      responseJson = execute(`aws ecs list-services --cluster ${cluster} --starting-token ${nextToken}`);
    } else {
      responseJson = execute(`aws ecs list-services --cluster ${cluster}`);
    }

    const response = JSON.parse(responseJson);
    const filtered = response.serviceArns.filter((arn) => getAppNameFromServiceArn(arn) === appName);
    serviceArns = serviceArns.concat(filtered);
    nextToken = response.nextToken;
  } while (nextToken);

  let services = [];
  for (let i = 0; i < serviceArns.length; i += 10) {
    const slicedServiceNames = serviceArns.slice(i, i + 10 > serviceArns.length ? serviceArns.length : i + 10);

    const servicesJson = execute(
      `aws ecs describe-services --cluster ${cluster} --services ${slicedServiceNames.join(' ')}`
    );
    services = services.concat(JSON.parse(servicesJson).services);
  }

  services.sort((a, b) => {
    if (a.createdAt < b.createdAt) {
      return 1;
    } else if (a.createdAt > b.createdAt) {
      return -1;
    } else {
      return 0;
    }
  });

  return services;
}

function getTargetGroups(appName) {
  console.log(`-> Discovering target groups for app "${appName}"`);

  let result = [];
  let nextToken = null;
  do {
    let responseJson;
    if (nextToken) {
      responseJson = execute(`aws elbv2 describe-target-groups --starting-token ${nextToken}`);
    } else {
      responseJson = execute('aws elbv2 describe-target-groups');
    }

    const response = JSON.parse(responseJson);
    const filtered = response.TargetGroups.filter(
      (targetGroup) => getAppNameFromTargetGroupName(targetGroup.TargetGroupName) === appName
    );

    result = result.concat(filtered);
    nextToken = response.NextMarker;
  } while (nextToken);

  return result;
}

function getResourcesToPrune(services, targetGroups, retain) {
  const servicesToRetain = services.slice(0, retain + 1);

  let servicesToPrune = services
    .slice(retain + 1)
    .reduce((m, service) => ({ ...m, [service.loadBalancers[0].targetGroupArn]: service }), {});

  let targetGroupsToPrune = targetGroups.reduce(
    (m, targetGroup) => ({ ...m, [targetGroup.TargetGroupArn]: targetGroup }),
    {}
  );

  for (const service of servicesToRetain) {
    delete targetGroupsToPrune[service.loadBalancers[0].targetGroupArn];
  }

  for (const targetGroup of Object.values(targetGroupsToPrune)) {
    if (targetGroup.LoadBalancerArns.length > 0) {
      delete targetGroupsToPrune[targetGroup.TargetGroupArn];
      delete servicesToPrune[targetGroup.TargetGroupArn];
    }
  }

  return {
    services: Object.values(servicesToPrune),
    targetGroups: Object.values(targetGroupsToPrune),
  };
}

function pruneService(service, cluster) {
  const serviceName = getServiceNameFromArn(service.serviceArn);
  console.log(`-> Pruning service ${serviceName}`);
  execute(`aws ecs delete-service --force --cluster ${cluster} --service ${service.serviceArn}`);
  console.log(`-> Finish pruning service ${serviceName}`);
}

function pruneTargetGroup(targetGroup) {
  console.log(`-> Pruning target group ${targetGroup.TargetGroupName}`);
  execute(`aws elbv2 delete-target-group --target-group-arn ${targetGroup.TargetGroupArn}`);
  console.log(`-> Finish pruning target group ${targetGroup.TargetGroupName}`);
}

function main() {
  console.log('\n» Pruning services and target groups...');

  const appName = core.getInput('app');
  const waypointConfigFilePath = core.getInput('waypoint_hcl_path');
  const retain = parseInt(core.getInput('retain'));

  const config = getAppConfig(waypointConfigFilePath, appName);
  const services = getServices(config.cluster, appName);

  if (!config.disableAlb) {
    try {
      const targetGroups = getTargetGroups(appName);
      const resourcesToPrune = getResourcesToPrune(services, targetGroups, retain);
      resourcesToPrune.services.forEach((service) => pruneService(service, cluster));
      resourcesToPrune.targetGroups.forEach((targetGroup) => pruneTargetGroup(targetGroup));
      console.log('-> Finish purging services and target groups');
    } catch (err) {
      console.error(err);
      throw err;
    }
  } else if (config.disableAlb && services.length > retain + 1) {
    try {
      services.slice(retain + 1).forEach((service) => pruneService(service, cluster));
      console.log('-> Finish purging services');
    } catch (err) {
      console.error(err);
      throw err;
    }
  }
}

main();
