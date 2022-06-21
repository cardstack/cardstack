const hcl = require('hcl2-parser');
const fs = require('fs');
const { execSync } = require('child_process');

function execute(command, options = {}) {
  return execSync(command, options).toString().trim();
}

function getAppConfig(waypointConfigFilePath, appName) {
  const waypointHcl = fs.readFileSync(waypointConfigFilePath, 'utf8');
  const waypointConfig = hcl.parseToObject(waypointHcl);
  const waypointApp = waypointConfig[0].app[appName];
  const cluster = waypointApp[0].deploy[0].use['aws-ecs'][0].cluster;

  return { cluster };
}

function getAppNameFromServiceArn(serviceArn) {
  const arnPattern = /^.*\/(.*)-[^-]*$/;
  const matches = serviceArn.match(arnPattern);
  return matches && matches.length > 1 ? matches[1] : '';
}

function getServiceNameFromArn(serviceArn) {
  const arnPattern = /^.*\//g;
  return serviceArn.replace(arnPattern, '');
}

function getServices(cluster, appName) {
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

function getStoppedTasks(cluster, serviceArn) {
  const serviceName = getServiceNameFromArn(serviceArn);

  let taskArns = [];
  let nextToken = null;
  do {
    const startingTokenArg = nextToken ? `--starting-token ${nextToken}` : '';
    const responseJson = execute(
      `aws ecs list-tasks --cluster ${cluster} --service-name ${serviceName} --desired-status STOPPED ${startingTokenArg}`
    );

    const response = JSON.parse(responseJson);
    taskArns = taskArns.concat(response.taskArns);
    nextToken = response.nextToken;
  } while (nextToken);

  let tasks = [];
  for (let i = 0; i < taskArns.length; i += 100) {
    const sliced = taskArns.slice(i, i + 100 > taskArns.length ? taskArns.length : i + 100);

    const tasksJson = execute(`aws ecs describe-tasks --cluster ${cluster} --tasks ${sliced.join(' ')}`);
    tasks = tasks.concat(JSON.parse(tasksJson).tasks);
  }

  tasks.sort((a, b) => {
    if (a.createdAt < b.createdAt) {
      return 1;
    } else if (a.createdAt > b.createdAt) {
      return -1;
    } else {
      return 0;
    }
  });

  return tasks;
}

function main(appName, waypointConfigFilePath) {
  const config = getAppConfig(waypointConfigFilePath, appName);
  const services = getServices(config.cluster, appName);
  const tasks = getStoppedTasks(config.cluster, services[0].serviceArn);

  if (tasks.length === 0) {
    return { hasStoppedTask: false };
  }

  const arnPattern = /^.*\//g;
  const taskID = tasks[0].taskArn.replace(arnPattern, '');

  return {
    hasStoppedTask: true,
    stoppedReason: tasks[0].stoppedReason,
    logsUrl: `https://console.aws.amazon.com/ecs/home#/clusters/${config.cluster}/tasks/${taskID}/logs`,
  };
}

exports.main = main;
