project = "cardstack"

# Labels can be specified for organizational purposes.
# labels = { "foo" = "bar" }

app "hub" {
    path = "./packages/hub"

    build {
        use "pack" {}

        registry {
            use "aws-ecr" {
                region     = "us-east-1"
                repository = "hub"
                tag        = "latest"
            }
        }
    }

    deploy {
        use "aws-ecs" {
            region = "us-east-1"
            memory = "512"
            cluster = "hub-prod"
            count = 2
            subnets = ["subnet-0c22641bd41cbdd1e", "subnet-01d36d7bcd0334fc0"]
            task_role_name = "hub-prod-hub_ecr_task"
            alb {
                listener_arn = "arn:aws:elasticloadbalancing:us-east-1:120317779495:listener/app/hub-prod/52cb41649112bec8/1ce6522a7998b3b4"
            }
        }

        hook {
            when    = "before"
            command = ["./packages/hub/bin/purge-services.sh", "hub-prod", "waypoint-hub"] # need this to purge old ecs services
        }

        hook {
            when    = "after"
            command = ["./packages/hub/bin/fix-listener.sh", "hub.cardstack.com"] # need this until https://github.com/hashicorp/waypoint/issues/1568
        }
    }
}
