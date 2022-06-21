import hcl from 'hcl2-parser';
import fs from 'fs';
import { execSync } from 'child_process';

function execute(command, options = {}) {
  return execSync(command, options).toString().trim();
}

function getWaypointConfig(waypointConfigFilePath) {
  const waypointHcl = fs.readFileSync(waypointConfigFilePath, 'utf8');
  const waypointConfig = hcl.parseToObject(waypointHcl)[0];

  let apps = [];

  for (const app in waypointConfig.app) {
    apps.push({
      name: app,
      cluster: waypointConfig.app[app][0].deploy[0].use['aws-ecs'][0].cluster,
      disableAlb: Boolean(waypointConfig.app[app][0].deploy[0].use['aws-ecs'][0].disable_alb),
    });
  }

  return apps;
}

function getAppNameFromServiceArn(serviceArn) {
  const arnPattern = /^.*\/(.*)-[^-]*$/;
  const matches = serviceArn.match(arnPattern);
  return matches && matches.length > 1 ? matches[1] : '';
}

function getLatestService(cluster, appName) {
  let serviceArns = [];
  let nextToken = null;
  do {
    const startingTokenArg = nextToken ? `--starting-token ${nextToken}` : '';
    const responseJson = execute(`aws ecs list-services --cluster ${cluster} ${startingTokenArg}`);
    const response = JSON.parse(responseJson);
    const filtered = response.serviceArns.filter((arn) => getAppNameFromServiceArn(arn) === appName);
    serviceArns = serviceArns.concat(filtered);
    nextToken = response.nextToken;
  } while (nextToken);

  let services = [];
  for (let i = 0; i < serviceArns.length; i += 10) {
    const slicedServiceNames = serviceArns.slice(i, i + 10 > serviceArns.length ? serviceArns.length : i + 10);

    const responseJson = execute(
      `aws ecs describe-services --cluster ${cluster} --services ${slicedServiceNames.join(' ')}`
    );
    const response = JSON.parse(responseJson);
    services = services.concat(response.services);
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

  return services[0];
}

function getLoadBalancer(appName) {
  const responseJson = execute(`aws elbv2 describe-load-balancers --names waypoint-ecs-${appName}`);
  const response = JSON.parse(responseJson);
  const loadBalancers = response.LoadBalancers;
  return loadBalancers[0];
}

function main() {
  const apps = getWaypointConfig('waypoint.hcl');
  const output = apps
    .map((app) => {
      const service = getLatestService(app.cluster, app.name);
      const subnets = service.networkConfiguration.awsvpcConfiguration.subnets;
      const securityGroups = service.networkConfiguration.awsvpcConfiguration.securityGroups;

      let _output =
        `app = ${app.name}\n` +
        `subnets = ${JSON.stringify(subnets)}\n` +
        `security_groups_ids = ${JSON.stringify(securityGroups)}`;

      if (!app.disableAlb) {
        const loadbalancer = getLoadBalancer(app.name);
        const albSubnets = loadbalancer.AvailabilityZones.map((az) => az.SubnetId);
        const servicePort = service.loadBalancers[0].containerPort;
        _output = _output + `\nservice_port = "${servicePort}"`;
        _output = _output + `\nalb subnets = ${JSON.stringify(albSubnets)}`;
      }
      return _output;
    })
    .join('\n\n');
  console.log(output);
}

try {
  main();
} catch (err) {
  console.error(err);
}
