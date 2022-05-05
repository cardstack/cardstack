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
            task_role_name = "hub-staging-ecr-task"
            execution_role_name = "hub-staging-ecr-task-executor-role"
            alb {
                listener_arn = "arn:aws:elasticloadbalancing:us-east-1:680542703984:listener/app/hub-staging/41bc43badc8a8782/0646e09e43df280f"
            }
            secrets = {
                LAYER1_RPC_NODE_HTTPS_URL = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_infura_https_url-aCpG9I"
                LAYER1_RPC_NODE_WSS_URL = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_infura_wss_url-eirZPn"
                LAYER2_RPC_NODE_HTTPS_URL = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_full_node_url-NBKUCq"
                LAYER2_RPC_NODE_WSS_URL = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_full_node_wss_url-4RtEaG"
                HUB_AUTH_SECRET = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_hub_auth_secret-50oF6K"
                HUB_EMAIL_CARD_DROP_RATE_LIMIT_COUNT = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_hub_email_card_drop_rate_limit_count-RdAViY"
                HUB_EMAIL_CARD_DROP_RATE_LIMIT_PERIOD_MINUTES = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_hub_email_card_drop_rate_limit_period_minutes-UKgldx"
                HUB_EMAIL_HASH_SALT = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_hub_email_hash_salt-nJvKQH"
                DISCORD_ON_CALL_INTERNAL_WEBHOOK = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_discord_on_call_internal_webhook-4ylxfM"
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

        hook {
            when    = "after"
            command = ["node", "./scripts/purge-target-groups.mjs", "hub"]
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
            task_role_name = "hub-staging-ecr-task"
            execution_role_name = "hub-staging-ecr-task-executor-role"
            disable_alb = true
            secrets = {
                LAYER1_RPC_NODE_HTTPS_URL = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_infura_https_url-aCpG9I"
                LAYER1_RPC_NODE_WSS_URL = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_infura_wss_url-eirZPn"
                LAYER2_RPC_NODE_HTTPS_URL = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_full_node_url-NBKUCq"
                LAYER2_RPC_NODE_WSS_URL = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_full_node_wss_url-4RtEaG"
                HUB_AUTH_SECRET = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_hub_auth_secret-50oF6K"
                DISCORD_ON_CALL_INTERNAL_WEBHOOK = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_discord_on_call_internal_webhook-4ylxfM"
            }
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
            task_role_name = "hub-staging-ecr-task"
            execution_role_name = "hub-staging-ecr-task-executor-role"
            disable_alb = true
            secrets = {
                LAYER1_RPC_NODE_HTTPS_URL = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_infura_https_url-aCpG9I"
                LAYER1_RPC_NODE_WSS_URL = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_infura_wss_url-eirZPn"
                LAYER2_RPC_NODE_HTTPS_URL = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_full_node_url-NBKUCq"
                LAYER2_RPC_NODE_WSS_URL = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_full_node_wss_url-4RtEaG"
                HUB_AUTH_SECRET = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_hub_auth_secret-50oF6K"
                DISCORD_ON_CALL_INTERNAL_WEBHOOK = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_discord_on_call_internal_webhook-4ylxfM"
            }
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
        task_role_name = "hub-staging-ecr-task"
        execution_role_name = "hub-staging-ecr-task-executor-role"
        disable_alb = true
        secrets = {
            LAYER1_RPC_NODE_HTTPS_URL = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_infura_https_url-aCpG9I"
            LAYER1_RPC_NODE_WSS_URL = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_infura_wss_url-eirZPn"
            LAYER2_RPC_NODE_HTTPS_URL = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_full_node_url-NBKUCq"
            LAYER2_RPC_NODE_WSS_URL = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_full_node_wss_url-4RtEaG"
            HUB_AUTH_SECRET = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_hub_auth_secret-50oF6K"
            DISCORD_ON_CALL_INTERNAL_WEBHOOK = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_discord_on_call_internal_webhook-4ylxfM"
        }
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
            cluster = "cardie"
            subnets = ["subnet-89968ba2"]
            task_role_name = "cardie-ecr-task"
            execution_role_name = "cardie-ecr-task-executor-role"
            disable_alb = true
            secrets = {
                DISCORD_TOKEN = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_discord_token-g5tbvH"
                GITHUB_TOKEN = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_github_token-sJaf5H"
            }
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
            execution_role_name = "cardpay-staging-subgraph-extraction-ecr-task-executor-role"
            secrets = {
                SE_DATABASE_STRING = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_subg_extract_database_url-kLIcg4",
                SE_OUTPUT_LOCATION = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_subg_extract_output_location-P04N4G"
            }
            disable_alb = true
        }
    }
}

app "ssr-web" {
    path = "./packages/ssr-web/deployment"

    build {
        use "docker" {
          dockerfile = "Dockerfile"
        }

        registry {
            use "aws-ecr" {
                region     = "us-east-1"
                repository = "ssr-web-staging"
                tag        = "latest"
            }
        }
    }

    deploy {
        use "aws-ecs" {
            service_port = 4000
            region = "us-east-1"
            memory = "512"
            cluster = "ssr-web-staging"
            count = 2
            subnets = ["subnet-09af2ce7fb316890b", "subnet-08c7d485ed397ca69"]
            task_role_name = "ssr-web-staging-ecr-task"

            alb {
                listener_arn = "arn:aws:elasticloadbalancing:us-east-1:680542703984:listener/app/ssr-web-staging/c0a4414517c7acb4/1b6996d108e2cbca"
            }
        }

        hook {
            when    = "before"
            command = ["./scripts/purge-services.sh", "ssr-web-staging", "waypoint-ssr-web", "2"] # need this to purge old ecs services
        }

        hook {
            when    = "after"
            command = ["node", "./scripts/fix-listener.mjs", "wallet-staging.stack.cards", "ssr-web-staging"] # need this until https://github.com/hashicorp/waypoint/issues/1568
        }
        hook {
            when    = "after"
            command = ["node", "./scripts/purge-target-groups.mjs", "ssr-web"]
        }
    }
}


app "reward-submit" {
    path = "./packages/reward-root-submitter"

    config {
        env = {
            ENVIRONMENT = "staging"
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
            execution_role_name = "reward-root-submitter-ecr-task-executor-role"
            disable_alb = true
            secrets = {
                EVM_FULL_NODE_URL = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_full_node_url-NBKUCq"
                OWNER = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_reward_root_submitter_address-5zx4lK"
                OWNER_PRIVATE_KEY = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_reward_root_submitter_private_key-4BFs6t"
            }
        }
    }
}