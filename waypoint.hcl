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
                repository = "hub-staging"
                tag        = "latest"
            }
        }
    }

    deploy {
        use "aws-ecs" {
            region = "us-east-1"
            memory = "512"
            cluster = "hub-staging"
            count = 2
            subnets = ["subnet-09af2ce7fb316890b", "subnet-08c7d485ed397ca69"]
            task_role_name = "hub-staging-hub_ecr_task"
            alb {
                listener_arn = "arn:aws:elasticloadbalancing:us-east-1:680542703984:listener/app/hub-staging/c6e5a0b971186e25/70f754699500538e"
            }
        }

        hook {
            when    = "before"
            command = ["./scripts/purge-services.sh", "hub-staging", "waypoint-hub", "2"] # need this to purge old ecs services
        }

        hook {
            when    = "after"
            command = ["./scripts/fix-listener.sh", "hub-staging.stack.cards", "hub-staging"] # need this until https://github.com/hashicorp/waypoint/issues/1568
        }
    }
}

app "hub-worker" {
    path = "./packages/hub"

    build {
        use "pack" {
            process_type = "worker"
        }

        registry {
            use "aws-ecr" {
                region     = "us-east-1"
                repository = "hub-worker-staging"
                tag        = "latest"
            }
        }
    }

    deploy {
        use "aws-ecs" {
            region = "us-east-1"
            memory = "512"
            cluster = "hub-worker-staging"
            count = 2
            subnets = ["subnet-09af2ce7fb316890b", "subnet-08c7d485ed397ca69"]
            task_role_name = "hub-staging-hub_ecr_task"
            disable_alb = true
        }

        hook {
            when    = "before"
            command = ["./scripts/purge-services.sh", "hub-worker-staging", "waypoint-hub-worker","1"] # need this to purge old ecs services
        }
    }
}

app "hub-bot" {
    path = "./packages/hub"

    build {
        use "pack" {
            process_type = "bot"
        }

        registry {
            use "aws-ecr" {
                region     = "us-east-1"
                repository = "hub-bot-staging"
                tag        = "latest"
            }
        }
    }

    deploy {
        use "aws-ecs" {
            region = "us-east-1"
            memory = "512"
            cluster = "hub-bot-staging"
            count = 1
            subnets = ["subnet-09af2ce7fb316890b", "subnet-08c7d485ed397ca69"]
            task_role_name = "hub-staging-hub_ecr_task"
            disable_alb = true
        }

        hook {
            when    = "before"
            command = ["./scripts/purge-services.sh", "hub-bot-staging", "waypoint-hub-bot","1"] # need this to purge old ecs services
        }
    }
}

app "cardie" {
    path = "./packages/cardie"

    build {
        use "pack" {
            process_type = "worker"
        }

        registry {
            use "aws-ecr" {
                region     = "us-east-1"
                repository = "cardie"
                tag        = "latest"
            }
        }
    }

    deploy {
        use "aws-ecs" {
            region = "us-east-1"
            memory = "512"
            count = 1
            cluster = "default"
            subnets = ["subnet-89968ba2"]
            task_role_name = "cardie-ecr-task"
            disable_alb = true
        }
    }
}
