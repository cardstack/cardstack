#!/bin/bash
set -e

CLUSTER=$1
TASK_DEFINITION=${2:-waypoint-hub}
COUNT=${3:-2}

if [ -z "$CLUSTER" ] || [ -z "$TASK_DEFINITION" ]; then
  echo "usage: $0 CLUSTER [TASK_DEFINITION] [COUNT]"
  exit 1
fi

SERVICE_LIST="$(aws ecs list-services --cluster $CLUSTER | jq -r '.serviceArns | .[]')"
if [ "$(echo $SERVICE_LIST | wc -w)" -gt 1 ]; then
  SORTED=($(aws ecs describe-services --cluster $CLUSTER --services $SERVICE_LIST | jq -r ".services | map(select(.taskDefinition | contains(\"/$TASK_DEFINITION:\"))) | sort_by(.createdAt) | .[].serviceName"))
  for SERVICE in ${SORTED[@]:$COUNT}; do
    aws ecs delete-service --cluster $CLUSTER --service $SERVICE --force
  done
fi
