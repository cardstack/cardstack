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
                listener_arn = "arn:aws:elasticloadbalancing:us-east-1:680542703984:listener/app/hub-staging/41bc43badc8a8782/0646e09e43df280f"
            }
        }

        hook {
            when    = "before"
            command = ["./scripts/purge-services.sh", "hub-staging", "waypoint-hub", "2"] # need this to purge old ecs services
        }

        hook {
            when    = "after"
            command = ["node", "./scripts/fix-listener.mjs", "hub-staging.stack.cards", "hub-staging"] # need this until https://github.com/hashicorp/waypoint/issues/1568
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
        use "docker" {
          dockerfile = "Dockerfile"
          build_args = {
              hub_command = "bot"
          }
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
              repository = "hub-event-listener-staging"
              tag        = "latest"
          }
      }
  }

  deploy {
      use "aws-ecs" {
          region = "us-east-1"
          memory = "512"
          cluster = "hub-event-listener-staging"
          count = 1
          subnets = ["subnet-09af2ce7fb316890b", "subnet-08c7d485ed397ca69"]
          task_role_name = "hub-staging-hub_ecr_task"
          disable_alb = true
      }

      hook {
          when    = "before"
          command = ["./scripts/purge-services.sh", "hub-event-listener-staging", "waypoint-hub-event-listener", "1"] # need this to purge old ecs services
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

# This name has been chosen to be much shorter than 32 characters
# If the name comes close to 32 characters there are unreliable
# deployments. See 
#  https://github.com/hashicorp/waypoint/issues/2957
# for more details
app "cardpay-subg-ext" {
    path = "./packages/cardpay-subgraph-extraction"

    config {
        env = {
            ENVIRONMENT = "staging"
        }
    }

    build {
        use "docker" {
          dockerfile = "Dockerfile"
        }

        registry {
            use "aws-ecr" {
                region     = "us-east-1"
                repository = "cardpay-staging-subgraph-extraction"
                tag        = "latest"
            }
        }
    }

    deploy {
        use "aws-ecs" {
            region = "us-east-1"
            memory = "512"
            cluster = "cardpay-staging-subgraph-extraction"
            count = 1
            subnets = ["subnet-081966e0d7a798bc1","subnet-0544a2e18d66d0040"]
            task_role_name = "cardpay-staging-subgraph-extraction-ecr-task"
            disable_alb = true
        }
    }
}

app "reward-submit" {
    path = "./packages/reward-root-submitter"

    config {
        env = {
            ENVIRONMENT = "staging"
            ETHEREUM_NODE_URL = "https://sokol-archive.blockscout.com/"
            REWARD_POOL_ADDRESS = "0xc9A238Ee71A65554984234DF9721dbdA873F84FA"
            REWARD_PROGRAM_OUTPUT="s3://tally-staging-reward-programs/"
        }
    }

    build {
        use "docker" {
          dockerfile = "Dockerfile"
        }

        registry {
            use "aws-ecr" {
                region     = "us-east-1"
                repository = "reward-root-submitter"
                tag        = "latest"
            }
        }
    }

    deploy {
        use "aws-ecs" {
            region = "us-east-1"
            memory = "512"
            cluster = "reward-root-submitter"
            count = 1
            task_role_name = "reward-root-submitter-ecr-task"
            disable_alb = true
            secrets = {
                OWNER = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_REWARD_ROOT_SUBMITTER_ADDRESS-AI2RY6"
                OWNER_PRIVATE_KEY = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_REWARD_ROOT_SUBMITTER_PRIVATE_KEY-47eL6P"
            }
        }
    }
}