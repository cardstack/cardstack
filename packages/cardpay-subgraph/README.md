# @cardstack/cardpay-subgraph

This project includes the subgraph necessary to generate a GraphQL based query system for the cardpay protocol.

The subgraph is hosted at:
- sokol: https://thegraph.com/explorer/subgraph/habdelra/cardpay-sokol
- xdai: https://thegraph.com/explorer/subgraph/habdelra/cardpay-xdai (TBD)

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
    yarn create-local-sokol
    ```
6. After you have made changes to your subgraph, in order to reindex and test out your subgraph locally you can run:
    ```
    yarn deploy-local-sokol
    ```
    The URL to try out your subgraph locally will be displayed after running this command.

## Building
The process of building the subgraph is two-fold. To begin make sure you are in the subgraph package:

```
cd packages/cardpay-subgraph
```

1. The first step is to generate assembly script files based on the subgraph definition file and the graphql schema:
    ```
    yarn codegen
    ```
2. The next step is to perform an assembly script compile:
    ```
    yarn build
    ```

## Deploying

To deploy the subgraph to The Graph, just run the following in the `@cardstack/cardpay-subgraph`:
```
yarn deploy-sokol
```
You may need to authenticate first if you have never authenticated with The Graph. If so, instructions will be provided to do that and ask Hassan for the access token.