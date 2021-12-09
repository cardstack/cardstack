
# Deployment

Green builds of the main branch deploy hub to staging if the commit contains changes to the hub package or its dependencies. The deploy uses waypoint.

## Overview

1. Release a new version of packages in the monorepo. This should create a tag that you will use in steps 2 and 3.

1. Create a changelog for the beta team to understand progress on the dApp by reviewing changes since last deploy.

1. Deploy hub and/or web-client to production using Cardie in the #releases-internal channel

1. Run migrations (if any)

1. Verify everything is working in prod

1. Post your changelog to #releases-internal, making sure to include the tag that was deployed.

See sections below for details on steps 1, 2, and 3.

## Step 1: Releasing a new version of the packages in the monorepo

The following instructions are based on our monorepo's maintainers' guide and will release all monorepo packages in lockstep. We should not update the changelog in the monorepo root for now, until  is resolved.

1. Get the latest code on main: git checkout main, git pull origin main

1. Make sure your history is clean with git status

1. Update all package versions, publish to npm, and push to GitHub with this command: 
   ```sh
   npx lerna publish --force-publish="*" --exact
   ```
   Copy the new tag, you will use this in the next steps.

## Step 2: Creating a changelog

Changelogs posted in the #releases-internal discord channel should be focused on user-facing parts of deployments, as they are primarily for the beta team to understand progress on the DApp. The current process of creating a changelog is quite manual:

1. Check #releases-internal channel for the last tag that was deployed. (finding the last deployed tag may become easier if we have CS-1384)

1. Go through commits/changes since that tag for relevant information. For convenience: `https://github.com/cardstack/cardstack/compare/<last-deployed-version>...<your-version>`

1. Do the writeup

Examples

https://discord.com/channels/584043165066199050/866667164764471346/868092003999703050

https://discord.com/channels/584043165066199050/866667164764471346/869492690826444820

## Step 3: Deploy using Cardie in the #releases-internal channel

Type the following commands in #releases-internal on Discord and Cardie B should tell you what's up. Copied from

https://discord.com/channels/584043165066199050/866667164764471346/883379195533754378:

Usage:
```
!deploy APP[:ref] [environment]
```

 Examples:
```
!deploy cardie:feature-branch-123 staging  (checkout to feature branch, deploy cardie to staging)
!deploy hub:hotfix-5678                    (checkout to hotfix branch, deploy hub to production)
!deploy web-client                         (checkout to main branch, deploy web-client to production)
```

## Step 4: Run migrations (if any)

Connect to the instance where the app is deployed:

```sh
waypoint exec -app=hub sh
```

Then, execute the db migrate command:

```sh
/workspace/packages/hub # node dist/hub.js db migrate up
```
