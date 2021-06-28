#!/bin/bash
SERVICE_LIST="$(aws ecs list-services --cluster $CLUSTER | jq -r '.serviceArns | .[]')"
if [ "$(echo $SERVICE_LIST | wc -w)" -gt 1 ]; then
  SORTED=("$(aws ecs describe-services --cluster $CLUSTER --services $SERVICE_LIST | jq -r '.services | map(select(.taskDefinition | contains("/waypoint-hub:"))) | sort_by(.createdAt) | .[].serviceName')")
  for SERVICE in ${SORTED[@]:2}; do
    echo $SERVICE
    # aws ecs delete-service --cluster $CLUSTER --service $SERVICE --force
  done
fi
