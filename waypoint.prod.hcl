project = "cardstack"

# Labels can be specified for organizational purposes.
# labels = { "foo" = "bar" }

app "hub" {
    path = "./packages/hub"

    build {
        use "docker" {
          dockerfile = "Dockerfile"
          build_args = {
              hub_command = "server"
          }
        }

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
            command = ["./scripts/purge-services.sh", "hub-prod", "waypoint-hub", "2"] # need this to purge old ecs services
        }

        hook {
            when    = "after"
            command = ["node", "./scripts/fix-listener.mjs", "hub.cardstack.com", "hub-prod"] # need this until https://github.com/hashicorp/waypoint/issues/1568
        }
    }
}

app "hub-worker" {
    path = "./packages/hub"

    build {
        use "docker" {
          dockerfile = "Dockerfile"
          build_args = {
              hub_command = "worker"
          }
        }

        registry {
            use "aws-ecr" {
                region     = "us-east-1"
                repository = "hub-worker-prod"
                tag        = "latest"
            }
        }
    }

    deploy {
        use "aws-ecs" {
            region = "us-east-1"
            memory = "512"
            cluster = "hub-worker-prod"
            count = 2
            subnets = ["subnet-0c22641bd41cbdd1e", "subnet-01d36d7bcd0334fc0"]
            task_role_name = "hub-prod-hub_ecr_task"
            disable_alb = true
        }

        hook {
            when    = "before"
            command = ["./scripts/purge-services.sh", "hub-worker-prod", "waypoint-hub-worker", "1"] # need this to purge old ecs services
        }
    }
}

app "hub-bot" {
    path = "./packages/hub"

    build {
        use "docker" {
          dockerfile = "Dockerfile"
          build_args = {
              hub_command = "bot"
          }
        }

        registry {
            use "aws-ecr" {
                region     = "us-east-1"
                repository = "hub-bot-prod"
                tag        = "latest"
            }
        }
    }

    deploy {
        use "aws-ecs" {
            region = "us-east-1"
            memory = "512"
            cluster = "hub-bot-prod"
            count = 1
            subnets = ["subnet-0c22641bd41cbdd1e", "subnet-01d36d7bcd0334fc0"]
            task_role_name = "hub-prod-hub_ecr_task"
            disable_alb = true
        }

        hook {
            when    = "before"
            command = ["./scripts/purge-services.sh", "hub-bot-prod", "waypoint-hub-bot", "1"] # need this to purge old ecs services
        }
    }
}

app "hub-event-listener" {
  path = "./packages/hub"

  build {
      use "docker" {
        dockerfile = "Dockerfile"
        build_args = {
            hub_command = "event-listener"
        }
      }

      registry {
          use "aws-ecr" {
              region     = "us-east-1"
              repository = "hub-event-listener-prod"
              tag        = "latest"
          }
      }
  }

  deploy {
      use "aws-ecs" {
          region = "us-east-1"
          memory = "512"
          cluster = "hub-event-listener-prod"
          count = 1
          subnets = ["subnet-0c22641bd41cbdd1e", "subnet-01d36d7bcd0334fc0"]
          task_role_name = "hub-prod-hub_ecr_task"
          disable_alb = true
      }

      hook {
          when    = "before"
          command = ["./scripts/purge-services.sh", "hub-event-listener-prod", "waypoint-hub-event-listener", "1"] # need this to purge old ecs services
      }
  }
}

# This name has been chosen to be much shorter than 32 characters
# If the name comes close to 32 characters there are unreliable
# deployments. See 
#  https://github.com/hashicorp/waypoint/issues/2957
# for more details
app "cardpay-subg-ext" {
    path = "./packages/cardpay-subgraph-extraction"

    config {
        env = {
            ENVIRONMENT = "production"
        }
    }

    build {
        use "docker" {
          dockerfile = "Dockerfile"
        }

        registry {
            use "aws-ecr" {
                region     = "us-east-1"
                repository = "cardpay-production-subgraph-extraction"
                tag        = "latest"
            }
        }
    }

    deploy {
        use "aws-ecs" {
            region = "us-east-1"
            memory = "512"
            cluster = "cardpay-production-subgraph-extraction"
            count = 1
            subnets = ["subnet-0544d680b5f494842","subnet-051e48e37cf15329c"]
            task_role_name = "cardpay-production-subgraph-extraction-ecr-task"
            disable_alb = true
        }
    }
}
