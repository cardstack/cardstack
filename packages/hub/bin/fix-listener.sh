#!/bin/sh
CERTIFICATE_ARN=$(aws acm list-certificates | grep -C1 hub-staging.stack.cards | grep CertificateArn | awk '{print $2}' | sed 's/[",]//g')
LISTENER_ARN=$(cat waypoint.hcl | grep listener_arn | awk '{ print $3 }' | sed 's/"//g')
FIX_CMD="aws elbv2 modify-listener --listener-arn $LISTENER_ARN --protocol HTTPS --port 443 --certificates CertificateArn=$CERTIFICATE_ARN --output table"
echo "$FIX_CMD"
$FIX_CMD
