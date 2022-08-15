const hcl = require('hcl2-parser');
const fs = require('fs');
const { execSync } = require('child_process');

function execute(command, options = {}) {
  return execSync(command, options).toString().trim();
}

function getAppConfig(waypointConfigFilePath, appName) {
  const waypointHcl = fs.readFileSync(waypointConfigFilePath, 'utf8');
  const waypointConfig = hcl.parseToObject(waypointHcl)[0];
  const waypointApp = waypointConfig.app[appName][0];
  const cluster = waypointApp.deploy[0].use['aws-ecs'][0].cluster;
  const disableAlb = Boolean(waypointApp.deploy[0].use['aws-ecs'][0].disable_alb);
  const certificate = disableAlb ? null : waypointApp.deploy[0].use['aws-ecs'][0].alb[0].certificate;

  return { cluster, certificate, disableAlb };
}

function getAppNameFromServiceArn(serviceArn) {
  const arnPattern = /^.*\/(.*)-[^-]*$/;
  const matches = serviceArn.match(arnPattern);
  return matches && matches.length > 1 ? matches[1] : '';
}

function getServices(cluster, appName) {
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

  return services;
}

function getLoadBalancer(appName) {
  const responseJson = execute(`aws elbv2 describe-load-balancers --names waypoint-ecs-${appName}`);
  const response = JSON.parse(responseJson);
  const loadBalancers = response.LoadBalancers;
  return loadBalancers[0];
}

function getListeners(loadBalancerArn) {
  const responseJson = execute(`aws elbv2 describe-listeners --load-balancer-arn ${loadBalancerArn}`);
  const response = JSON.parse(responseJson);
  const listeners = response.Listeners;
  return listeners;
}

function createListener(loadBalancerArn, certificateArn, targetGroupArn) {
  const loadBalancerArnArg = `--load-balancer-arn ${loadBalancerArn}`;
  const certificatesArg = `--certificates CertificateArn=${certificateArn}`;
  const defaultActionsArg = `--default-actions Type=forward,TargetGroupArn=${targetGroupArn}`;

  execute(
    `aws elbv2 create-listener --protocol HTTPS --port 443 ${loadBalancerArnArg} ${certificatesArg} ${defaultActionsArg}`
  );
}

function main(appName, waypointConfigFilePath) {
  const config = getAppConfig(waypointConfigFilePath, appName);

  if (config.disableAlb) {
    console.log(`App '${appName}' does not require a load balancer.`);
    return;
  }

  const services = getServices(config.cluster, appName);
  const loadBalancer = getLoadBalancer(appName);
  const listeners = getListeners(loadBalancer.LoadBalancerArn);

  if (!listeners.some((listener) => listener.Port === 443)) {
    const targetGroupArn = services[0].loadBalancers[0].targetGroupArn;
    console.log(
      `Unable to find listener (port 443) for app '${appName}'. Creating a listener with the target group of the latest service: ${targetGroupArn}`
    );
    createListener(loadBalancer.LoadBalancerArn, config.certificate, targetGroupArn);
  } else {
    console.log(`Listener (port 443) found for app '${appName}'`);
  }
}

exports.main = main;
