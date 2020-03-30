#!/bin/bash

set -e
target_env=$1;
docker_image_label=$2

if [ -n "$TARGET_NAME" ]; then
  echo "Deploying to $TARGET_NAME"
fi

# These are all supposed to come from github secrets
for variable in PGHOST \
                PGPORT \
                PGUSER \
                PGPASSWORD \
                EMBER_DEPLOY_AWS_ACCESS_KEY_ID \
                EMBER_DEPLOY_AWS_SECRET_ACCESS_KEY \
                HUB_URL \
                META_REALM_URL \
                DEFAULT_REALM_URL \
                SWARM_CONTROLLER \
                LOG_LEVELS \
                RECENT_ONLY \
                CARDSTACK_SESSIONS_KEY; do
    command="export ${variable}=\$${target_env}_${variable}"
    eval $command
done

#env agnostic env vars
for variable in GITHUB_BRANCH \
                ECR_ENDPOINT; do
    command="export ${variable}=\$${variable}"
    eval $command
done

export TARGET_ENV="builder-$target_env"

docker tag cardhost $ECR_ENDPOINT:$docker_image_label

# This needs to be exported because our docker-compose.yml below is interpolating it
# We are authorized to push because earlier in our .travis.yml we logged in via "aws ecr"
export DIGEST=`docker push $ECR_ENDPOINT:$docker_image_label | grep digest: | cut -d " " -f 3`

echo "Published digest $DIGEST for $ECR_ENDPOINT:$docker_image_label"

export HUB_ENVIRONMENT="production" # all builds that we deploy are prod builds

cat >> ~/.ssh/known_hosts < ./deploy/known_hosts
socat "UNIX-LISTEN:/tmp/cardstack-remote-docker-$target_env,reuseaddr,fork" EXEC:"ssh -i $HOME/.ssh/id_rsa -T docker-control@$SWARM_CONTROLLER" &
remote=unix:///tmp/cardstack-remote-docker-$target_env
docker -H $remote stack deploy --with-registry-auth -c ./deploy/docker-compose.yml hub

DOCKER_HOST=$remote node deploy/watch-docker.js $GITHUB_BUILD_ID

# only include env vars necessary for ember deploy
docker run --rm --network cardstack \
          --env AWS_SECRET_ACCESS_KEY=$EMBER_DEPLOY_AWS_SECRET_ACCESS_KEY \
          --env AWS_ACCESS_KEY_ID=$EMBER_DEPLOY_AWS_ACCESS_KEY_ID \
          --env HUB_URL \
          --env TARGET_NAME \
          --workdir /srv/hub/packages/cardhost \
          cardhost ../../node_modules/.bin/ember deploy $target_env --verbose