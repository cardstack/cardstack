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
      region              = "us-east-1"
      memory              = "512"
      cluster             = "hub-prod"
      count               = 2
      subnets             = ["subnet-0c22641bd41cbdd1e", "subnet-01d36d7bcd0334fc0"]
      task_role_name      = "hub-ecr-task"
      execution_role_name = "hub-ecr-task-executor-role"

      alb {
        certificate = "arn:aws:acm:us-east-1:120317779495:certificate/20f287dd-ba3c-4175-8b06-5c3b1e75f6d9"
      }

      secrets = {
        LAYER1_RPC_NODE_HTTPS_URL                     = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_infura_https_url-p9kYAu"
        LAYER1_RPC_NODE_WSS_URL                       = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_infura_wss_url-cTukZK"
        LAYER2_RPC_NODE_HTTPS_URL                     = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_full_node_url-K67DON"
        LAYER2_RPC_NODE_WSS_URL                       = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_full_node_wss_url-BXGFlG"
        HUB_AUTH_SECRET                               = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_hub_auth_secret-amva1E"
        HUB_EMAIL_CARD_DROP_RATE_LIMIT_COUNT          = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_hub_email_card_drop_rate_limit_count-mdtxRC"
        HUB_EMAIL_CARD_DROP_RATE_LIMIT_PERIOD_MINUTES = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_hub_email_card_drop_rate_limit_period_minutes-m71GVI"
        HUB_EMAIL_HASH_SALT                           = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_hub_email_hash_salt-6j6HZV"
        DISCORD_ON_CALL_INTERNAL_WEBHOOK              = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_discord_on_call_internal_webhook-n7SCZC"
        PAGERDUTY_TOKEN                               = "arn:aws:secretsmanager:us-east-1:120317779495:secret:PAGERDUTY_TOKEN-1L68JJ"
        MAILCHIMP_API_KEY                             = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_MAILCHIMP_API_KEY-XCGDUW"
        CRYPTOCOMPARE_API_KEY                         = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_CRYPTOCOMPARE_API_KEY-c9yTJ9"
      }
    }

    hook {
      when    = "after"
      command = ["node", "./scripts/wait-service-stable.mjs", "hub"]
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
      region              = "us-east-1"
      memory              = "512"
      cluster             = "hub-worker-prod"
      count               = 2
      subnets             = ["subnet-0c22641bd41cbdd1e", "subnet-01d36d7bcd0334fc0"]
      task_role_name      = "hub-ecr-task"
      execution_role_name = "hub-ecr-task-executor-role"
      disable_alb         = true

      secrets = {
        LAYER1_RPC_NODE_HTTPS_URL        = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_infura_https_url-p9kYAu"
        LAYER1_RPC_NODE_WSS_URL          = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_infura_wss_url-cTukZK"
        LAYER2_RPC_NODE_HTTPS_URL        = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_full_node_url-K67DON"
        LAYER2_RPC_NODE_WSS_URL          = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_full_node_wss_url-BXGFlG"
        HUB_AUTH_SECRET                  = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_hub_auth_secret-amva1E"
        DISCORD_ON_CALL_INTERNAL_WEBHOOK = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_discord_on_call_internal_webhook-n7SCZC"
        PAGERDUTY_TOKEN                  = "arn:aws:secretsmanager:us-east-1:120317779495:secret:PAGERDUTY_TOKEN-1L68JJ"
        MAILCHIMP_API_KEY                = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_MAILCHIMP_API_KEY-XCGDUW"
      }
    }

    hook {
      when    = "after"
      command = ["node", "./scripts/wait-service-stable.mjs", "hub-worker"]
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
      region              = "us-east-1"
      memory              = "512"
      cluster             = "hub-bot-prod"
      count               = 1
      subnets             = ["subnet-0c22641bd41cbdd1e", "subnet-01d36d7bcd0334fc0"]
      task_role_name      = "hub-ecr-task"
      execution_role_name = "hub-ecr-task-executor-role"
      disable_alb         = true

      secrets = {
        LAYER1_RPC_NODE_HTTPS_URL        = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_infura_https_url-p9kYAu"
        LAYER1_RPC_NODE_WSS_URL          = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_infura_wss_url-cTukZK"
        LAYER2_RPC_NODE_HTTPS_URL        = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_full_node_url-K67DON"
        LAYER2_RPC_NODE_WSS_URL          = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_full_node_wss_url-BXGFlG"
        HUB_AUTH_SECRET                  = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_hub_auth_secret-amva1E"
        DISCORD_ON_CALL_INTERNAL_WEBHOOK = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_discord_on_call_internal_webhook-n7SCZC"
        PAGERDUTY_TOKEN                  = "arn:aws:secretsmanager:us-east-1:120317779495:secret:PAGERDUTY_TOKEN-1L68JJ"
      }
    }

    hook {
      when    = "after"
      command = ["node", "./scripts/wait-service-stable.mjs", "hub-bot"]
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
      region              = "us-east-1"
      memory              = "512"
      cluster             = "hub-event-listener-prod"
      count               = 1
      subnets             = ["subnet-0c22641bd41cbdd1e", "subnet-01d36d7bcd0334fc0"]
      task_role_name      = "hub-ecr-task"
      execution_role_name = "hub-ecr-task-executor-role"
      disable_alb         = true

      secrets = {
        LAYER1_RPC_NODE_HTTPS_URL        = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_infura_https_url-p9kYAu"
        LAYER1_RPC_NODE_WSS_URL          = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_infura_wss_url-cTukZK"
        LAYER2_RPC_NODE_HTTPS_URL        = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_full_node_url-K67DON"
        LAYER2_RPC_NODE_WSS_URL          = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_full_node_wss_url-BXGFlG"
        HUB_AUTH_SECRET                  = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_hub_auth_secret-amva1E"
        DISCORD_ON_CALL_INTERNAL_WEBHOOK = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_discord_on_call_internal_webhook-n7SCZC"
        PAGERDUTY_TOKEN                  = "arn:aws:secretsmanager:us-east-1:120317779495:secret:PAGERDUTY_TOKEN-1L68JJ"
      }
    }

    hook {
      when    = "after"
      command = ["node", "./scripts/wait-service-stable.mjs", "hub-event-listener"]
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
      region              = "us-east-1"
      memory              = "512"
      cluster             = "cardpay-production-subgraph-extraction"
      count               = 1
      subnets             = ["subnet-0544d680b5f494842", "subnet-051e48e37cf15329c"]
      task_role_name      = "cardpay-production-subgraph-extraction-ecr-task"
      execution_role_name = "cardpay-production-subgraph-extraction-ecr-task-executor-role"

      secrets = {
        SE_DATABASE_STRING = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_subg_extract_database_url-5HyPh7"
        SE_OUTPUT_LOCATION = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_subg_extract_output_location-YDoQUt"
      }

      disable_alb = true
    }

    hook {
      when    = "after"
      command = ["node", "./scripts/wait-service-stable.mjs", "cardpay-subg-ext"]
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
        repository = "ssr-web-prod"
        tag        = "latest"
      }
    }
  }

  deploy {
    use "aws-ecs" {
      service_port   = 4000
      region         = "us-east-1"
      memory         = "512"
      cluster        = "ssr-web-prod"
      count          = 2
      subnets        = ["subnet-0c22641bd41cbdd1e", "subnet-01d36d7bcd0334fc0"]
      task_role_name = "ssr-web-prod-ecr-task"

      alb {
        certificate = "arn:aws:acm:us-east-1:120317779495:certificate/e1d6a1c7-456e-4058-b90b-9c603a65734d"
      }
    }

    hook {
      when    = "after"
      command = ["node", "./scripts/wait-service-stable.mjs", "ssr-web"]
    }
  }
}

app "reward-submit" {
  path = "./packages/reward-root-submitter"

  config {
    env = {
      ENVIRONMENT           = "production"
      REWARD_POOL_ADDRESS   = "0x340EB99eB9aC7DB3a3eb68dB76c6F62738DB656a"
      REWARD_PROGRAM_OUTPUT = "s3://cardpay-production-reward-programs/"
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
      region              = "us-east-1"
      memory              = "512"
      cluster             = "reward-root-submitter"
      count               = 1
      task_role_name      = "reward-root-submitter-ecr-task"
      execution_role_name = "reward-root-submitter-ecr-task-executor-role"
      disable_alb         = true

      secrets = {
        EVM_FULL_NODE_URL = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_full_node_url-K67DON"
        OWNER             = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_reward_root_submitter_address-ePRiLk"
        OWNER_PRIVATE_KEY = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_reward_root_submitter_private_key-Eflz67"
        SENTRY_DSN        = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_reward_root_submitter_sentry_dsn-DjQjLC"
      }
    }

    hook {
      when    = "after"
      command = ["node", "./scripts/wait-service-stable.mjs", "reward-submit"]
    }
  }
}

app "reward-api" {
  path = "./packages/cardpay-reward-api"

  config {
    env = {
      ENVIRONMENT    = "production"
      REWARDS_BUCKET = "s3://cardpay-production-reward-programs"
      SUBGRAPH_URL   = "https://graph.cardstack.com/subgraphs/name/habdelra/cardpay-xdai"
    }
  }

  build {
    use "docker" {
      dockerfile = "Dockerfile"
    }

    registry {
      use "aws-ecr" {
        region     = "us-east-1"
        repository = "reward-api"
        tag        = "latest"
      }
    }
  }

  deploy {
    use "aws-ecs" {
      service_port        = 8000
      region              = "us-east-1"
      memory              = "512"
      cluster             = "reward-api"
      count               = 2
      subnets             = ["subnet-0d71c50519109f369", "subnet-03eac43ed0e35227e"]
      task_role_name      = "reward-api-ecs-task"
      execution_role_name = "reward-api-ecs-task-execution"

      alb {
        certificate = "arn:aws:acm:us-east-1:120317779495:certificate/e8ea5aa9-f28e-40ea-88a6-05ff8f47fa5e"
      }

      secrets = {
        DB_STRING  = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_reward_api_database_url-EIMQl7"
        SENTRY_DSN = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_reward_api_sentry_dsn-Pwim3k"
        EVM_FULL_NODE_URL = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_full_node_url-K67DON"
      }
    }

    hook {
      when    = "after"
      command = ["node", "./scripts/wait-service-stable.mjs", "reward-api"]
    }
  }
}

app "reward-indexer" {
  path = "./packages/cardpay-reward-indexer"

  config {
    env = {
      ENVIRONMENT    = "production"
      REWARDS_BUCKET = "s3://cardpay-production-reward-programs"
      SUBGRAPH_URL   = "https://graph.cardstack.com/subgraphs/name/habdelra/cardpay-xdai"
    }
  }

  build {
    use "docker" {
      dockerfile = "Dockerfile"
    }

    registry {
      use "aws-ecr" {
        region     = "us-east-1"
        repository = "reward-indexer"
        tag        = "latest"
      }
    }
  }

  deploy {
    use "aws-ecs" {
      region              = "us-east-1"
      memory              = "512"
      cluster             = "reward-indexer"
      count               = 1
      subnets             = ["subnet-0d71c50519109f369", "subnet-03eac43ed0e35227e"]
      task_role_name      = "reward-indexer-ecs-task"
      execution_role_name = "reward-indexer-ecs-task-execution"
      disable_alb         = true

      secrets = {
        DB_STRING  = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_reward_api_database_url-EIMQl7"
        SENTRY_DSN = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_reward_api_sentry_dsn-Pwim3k"
      }
    }

    hook {
      when    = "after"
      command = ["node", "./scripts/wait-service-stable.mjs", "reward-indexer"]
    }
  }
}

app "reward-scheduler" {
  path = "./packages/cardpay-reward-scheduler"

  config {
    env = {
      ENVIRONMENT    = "production"
      REWARDS_BUCKET = "s3://cardpay-production-reward-programs"
      SUBGRAPH_URL   = "https://graph.cardstack.com/subgraphs/name/habdelra/cardpay-xdai"
      REWARD_SCHEDULER_APPROVED_PROGRAMS = "0x979C9F171fb6e9BC501Aa7eEd71ca8dC27cF1185"
      REWARD_MANAGER_ADDRESS = "0xDbAe2bC81bFa4e46df43a34403aAcde5FFdB2A9D"
      REWARDS_SUBGRAPH_EXTRACTION = "s3://cardpay-production-partitioned-graph-data/data/rewards/0.0.2/"
      REWARD_SCHEDULER_UPDATE_FREQUENCY = "600"
    }
  }

  build {
    use "docker" {
      dockerfile = "Dockerfile"
    }

    registry {
      use "aws-ecr" {
        region     = "us-east-1"
        repository = "cardpay-reward-scheduler-production"
        tag        = "latest"
      }
    }
  }

  deploy {
    use "aws-ecs" {
      region              = "us-east-1"
      memory              = "512"
      cluster             = "cardpay-reward-scheduler-production"
      count               = 1
      task_role_name      = "reward-programs-scheduler-ecr-task"
      execution_role_name = "reward-programs-scheduler-ecr-task-executor-role"
      disable_alb         = true

      secrets = {
        SENTRY_DSN = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_reward_programs_sentry_dsn-lsCwEe"
        EVM_FULL_NODE_URL = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_full_node_url-K67DON"
      }
    }
  }
}
