# @cardstack/cardpay-subgraph

This project includes the subgraph necessary to generate a GraphQL based query system for the cardpay protocol.

The subgraph is hosted at:
- xdai: https://graph.cardstack.com/subgraphs/name/habdelra/cardpay-xdai/graphql
- sokol: https://graph-staging.stack.cards/subgraphs/name/habdelra/cardpay-sokol/graphql

On these URL's you will find a GraphQL explorer to help craft your queries.

The subgraph is written in Assembly Script, which is a narrow subset of TypeScript. The AssemblyScript reference is available here: https://www.assemblyscript.org/introduction.html. Additionally a wonderful guide for creating subgraphs, as well as the documented API is available here: https://thegraph.com/docs/introduction

## Developing
In order to develop a subgraph locally you need to run a local graph node. Instructions for this can be found at https://thegraph.com/docs/quick-start#2.-run-a-local-graph-node. The steps are:
1. Clone Graph Node with
    ```
    git clone https://github.com/graphprotocol/graph-node/
    ```

2. Update the `docker/docker-compose.yaml` file with an entry for the ethereum node in the graph-node's service's environment settings. For sokol that is: `poa-sokol:https://sokol-archive.blockscout.com`

3. Enter the docker/ directory:
    ```
    cd docker
    ```
4. Start a local Graph Node that will connect to Ganache on your host:
    ```
    docker-compose up
    ```
5. The very first time you start a graph node you'll need to create your subgraph. Back in the `@cardstack/cardpay-subgraph` package execute the following:
    ```
    yarn create-local
    ```
6. You can then deploy and re-index to test out your subgraph locally (then can be done as you update your subgraph in order to see your changes locally as well):
    ```
    yarn deploy-local
    ```
    The URL to try out your subgraph locally will be displayed after running this command.

## Building
The process of building the subgraph is two-fold. To begin make sure you are in the subgraph package:

```
cd packages/cardpay-subgraph
```

1. The first step is to generate assembly script files based on the subgraph definition file and the graphql schema (note: for faster deploys using grafting, see the grafting section below)):
    ```
    yarn codegen
    ```
2. The next step is to perform an assembly script compile:
    ```
    yarn build
    ```

## Deploying

### Authentication
If you have never performed a deploy then you will need to perform a first time authentication for each of the graph nodes that we deploy too. Currently we deploy to a graph node hosted by Cardstack. Each has different access tokens for each environment. The access token for Cardstack can be found in the AWS secrets manager in the respective environment.

Once you have located your access token, from the `packages/cardpay-subgraph` directory execute:
```sh
$ graph auth https://graph-admin-green.stack.cards <Cardstack access token>
$ graph auth https://graph-admin-blue.stack.cards <Cardstack access token>
$ graph auth https://graph-admin-green.cardstack.com <Cardstack access token>
$ graph auth https://graph-admin-blue.cardstack.com <Cardstack access token>
```

After you have performed this authorization you will not need to perform this again for subsequent deployments.

### Deployment
To deploy the subgraph to both The Graph and one of our hosted graph nodes, run either the following in the `@cardstack/cardpay-subgraph`:
```
yarn deploy-sokol-green
```
which deploys to the sokol green node, or
```
yarn deploy-sokol-blue
```
which deploys to the blue node

To check the sync status of either node, run:
```
yarn sokol-green-status
```
or
```
yarn sokol-blue-status
```


### Grafting

Each time we deploy to a graph node we need to re-index the subgraph from scratch. 

For the some deploys, and particularly for hotfixes, the broad structure will not change and a large amount of work will be repeated to reindex.

This gets progressively longer as each day there is more data to process.

Subgraph supports a process called grafting where the data for an existing subgraph is used for everything up to a set block, then the new subgraph code is used beyond that point.

As this does not reprocess the old data, there are restrictions on the type of updates that can be performed with this

> The grafted subgraph can use a GraphQL schema that is not identical to the one of the base subgraph, but merely compatible with it. It has to be a valid subgraph schema in its own right but may deviate from the base subgraph's schema in the following ways:

> * It adds or removes entity types

> * It removes attributes from entity types

> * It adds nullable attributes to entity types

> * It turns non-nullable attributes into nullable attributes

> * It adds values to enums

> * It adds or removes interfaces

> * It changes for which entity types an interface is implemented

https://thegraph.com/docs/en/developer/create-subgraph-hosted/#grafting-onto-existing-subgraphs

If grafting is appropriate, there is a helper for each node at the codegen stage. Instead of `yarn codegen` for the production green node run 

    yarn codegen-graft-xdai-green

This will get the latest deployment ID and the last successful block number for you. The yaml file produced *must* be used to deploy onto this specific node.

Rolling back to an earlier block is possible, just modify the `block` in the `graft` top level definition in `subgraph.yaml`.