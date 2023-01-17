import hcl from 'hcl2-parser';
import fs from 'fs';

// messy data structure produced by naive parsing from hcl2-parser library
interface WaypointHcl {
  project: string;
  app: {
    [name: string]: WaypointHclAppStanza[];
  };
}

interface WaypointHclAppStanza {
  path?: string;
  deploy: WaypointHclDeployStanza[];
}

interface WaypointHclDeployStanza {
  use: {
    [name: string]: WaypointHclUseStanza[];
  };
}

interface WaypointHclUseStanza {}

interface WaypointHclAwsEcsStanza extends WaypointHclUseStanza {
  cluster?: string;
  service_port?: number;
  execution_role_name?: string;

  alb?: {
    subnets?: string[];
    certificate?: string;
  }[];

  secrets?: {
    [key: string]: string;
  };
}

class WaypointConfig {
  apps: Map<string, WaypointApp>;

  constructor(path?: string) {
    this.apps = new Map<string, WaypointApp>();

    if (typeof path === 'undefined') {
      return;
    }

    let content = fs.readFileSync(path, 'utf8');
    let config: WaypointHcl = hcl.parseToObject(content)[0];

    for (const app in config.app) {
      const _app: WaypointApp = {
        name: app,
        deploy: {
          uses: {},
        },
      };

      for (const use in config.app[app][0].deploy[0].use) {
        _app.deploy.uses[use] = config.app[app][0].deploy[0].use[use][0];
      }

      this.apps.set(app, _app);
    }
  }
}

interface WaypointApp {
  name: string;
  path?: string;
  deploy: WaypointAppDeployBlock;
}

interface WaypointAppDeployBlock {
  uses: {
    [name: string]: WaypointDeployPlugin;
  };
  hooks?: WaypointHook[];
}

interface WaypointHook {}

interface WaypointDeployPlugin {}

interface WaypointDeployAwsEcsPlugin extends WaypointDeployPlugin {
  region?: string;
  memory?: string;
  cluster?: string;
  count?: number;
  subnets?: string;
  task_role_name?: string;
  execution_role_name?: string;
  security_group_ids?: string;
  disable_alb?: string;
  secrets: {
    [key: string]: string;
  };
}

interface WaypointDeployAwsEcsPluginAlbConfig {
  subnets?: string[];
  certificate?: string;
}

export { WaypointConfig, WaypointDeployAwsEcsPlugin };
