import {
  ECRClient,
  DescribeRepositoriesCommand,
  PutLifecyclePolicyCommand,
  Repository,
  GetLifecyclePolicyCommand,
} from '@aws-sdk/client-ecr';

const policy = JSON.stringify({
  rules: [
    {
      rulePriority: 1,
      description: 'remove images with count more than 100',
      selection: {
        tagStatus: 'any',
        countType: 'imageCountMoreThan',
        countNumber: 100,
      },
      action: {
        type: 'expire',
      },
    },
  ],
});

async function main() {
  try {
    const client = new ECRClient({});
    let repos: Repository[] = [];
    let nextToken: string = undefined;

    do {
      const command = new DescribeRepositoriesCommand(nextToken ? { nextToken } : {});
      const res = await client.send(command);
      nextToken = res.nextToken;
      repos = repos.concat(res.repositories);
    } while (nextToken != undefined);

    for (const repo of repos) {
      let getCommand = new GetLifecyclePolicyCommand({
        repositoryName: repo.repositoryName,
      });
      const res = await client.send(getCommand);

      if (res.lifecyclePolicyText != policy) {
        console.info(`updating lifecycle policy for ${repo.repositoryName}`);
        let putCommand = new PutLifecyclePolicyCommand({
          repositoryName: repo.repositoryName,
          lifecyclePolicyText: policy,
        });
        await client.send(putCommand);
      }
    }
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }
}

main();
