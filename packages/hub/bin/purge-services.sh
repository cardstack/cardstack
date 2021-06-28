#!/bin/bash
set -e

CLUSTER=$1
TASK_DEFINITION=${2:-waypoint-hub}
if [ -z "$CLUSTER" ] || [ -z "$TASK_DEFINITION" ]; then
  echo "usage: purge-service.sh CLUSTER [TASK_DEFINITION]"
  exit 1
fi

SERVICE_LIST="$(aws ecs list-services --cluster $CLUSTER | jq -r '.serviceArns | .[]')"
if [ "$(echo $SERVICE_LIST | wc -w)" -gt 1 ]; then
  SORTED=("$(aws ecs describe-services --cluster $CLUSTER --services $SERVICE_LIST | jq -r ".services | map(select(.taskDefinition | contains(\"/$TASK_DEFINITION:\"))) | sort_by(.createdAt) | .[].serviceName")")
  for SERVICE in ${SORTED[@]:2}; do
    aws ecs delete-service --cluster $CLUSTER --service $SERVICE --force
  done
fi
