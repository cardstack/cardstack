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
      region              = "us-east-1"
      memory              = "512"
      cluster             = "hub-staging"
      count               = 2
      subnets             = ["subnet-09af2ce7fb316890b", "subnet-08c7d485ed397ca69"]
      task_role_name      = "hub-staging-ecr-task"
      execution_role_name = "hub-staging-ecr-task-executor-role"

      alb {
        certificate = "arn:aws:acm:us-east-1:680542703984:certificate/f7de489d-e9fc-4191-8b85-efab3eda9a7f"
      }

      secrets = {
        LAYER1_RPC_NODE_HTTPS_URL                     = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_infura_https_url-aCpG9I"
        LAYER1_RPC_NODE_WSS_URL                       = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_infura_wss_url-eirZPn"
        LAYER2_RPC_NODE_HTTPS_URL                     = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_full_node_url-NBKUCq"
        LAYER2_RPC_NODE_WSS_URL                       = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_full_node_wss_url-4RtEaG"
        HUB_AUTH_SECRET                               = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_hub_auth_secret-50oF6K"
        HUB_EMAIL_CARD_DROP_RATE_LIMIT_COUNT          = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_hub_email_card_drop_rate_limit_count-RdAViY"
        HUB_EMAIL_CARD_DROP_RATE_LIMIT_PERIOD_MINUTES = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_hub_email_card_drop_rate_limit_period_minutes-UKgldx"
        HUB_EMAIL_HASH_SALT                           = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_hub_email_hash_salt-nJvKQH"
        DISCORD_ON_CALL_INTERNAL_WEBHOOK              = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_discord_on_call_internal_webhook-4ylxfM"
        PAGERDUTY_TOKEN                               = "arn:aws:secretsmanager:us-east-1:680542703984:secret:PAGERDUTY_TOKEN-kTxFxL"
        MAILCHIMP_API_KEY                             = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_MAILCHIMP_API_KEY-lkxsEk"
        CRYPTOCOMPARE_API_KEY                         = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_CRYPTOCOMPARE_API_KEY-3Sk0nr"
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
        repository = "hub-worker-staging"
        tag        = "latest"
      }
    }
  }

  deploy {
    use "aws-ecs" {
      region              = "us-east-1"
      memory              = "512"
      cluster             = "hub-worker-staging"
      count               = 2
      subnets             = ["subnet-09af2ce7fb316890b", "subnet-08c7d485ed397ca69"]
      task_role_name      = "hub-staging-ecr-task"
      execution_role_name = "hub-staging-ecr-task-executor-role"
      disable_alb         = true

      secrets = {
        LAYER1_RPC_NODE_HTTPS_URL        = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_infura_https_url-aCpG9I"
        LAYER1_RPC_NODE_WSS_URL          = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_infura_wss_url-eirZPn"
        LAYER2_RPC_NODE_HTTPS_URL        = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_full_node_url-NBKUCq"
        LAYER2_RPC_NODE_WSS_URL          = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_full_node_wss_url-4RtEaG"
        HUB_AUTH_SECRET                  = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_hub_auth_secret-50oF6K"
        DISCORD_ON_CALL_INTERNAL_WEBHOOK = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_discord_on_call_internal_webhook-4ylxfM"
        PAGERDUTY_TOKEN                  = "arn:aws:secretsmanager:us-east-1:680542703984:secret:PAGERDUTY_TOKEN-kTxFxL"
        MAILCHIMP_API_KEY                = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_MAILCHIMP_API_KEY-lkxsEk"
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
        repository = "hub-bot-staging"
        tag        = "latest"
      }
    }
  }

  deploy {
    use "aws-ecs" {
      region              = "us-east-1"
      memory              = "512"
      cluster             = "hub-bot-staging"
      count               = 1
      subnets             = ["subnet-09af2ce7fb316890b", "subnet-08c7d485ed397ca69"]
      task_role_name      = "hub-staging-ecr-task"
      execution_role_name = "hub-staging-ecr-task-executor-role"
      disable_alb         = true

      secrets = {
        LAYER1_RPC_NODE_HTTPS_URL        = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_infura_https_url-aCpG9I"
        LAYER1_RPC_NODE_WSS_URL          = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_infura_wss_url-eirZPn"
        LAYER2_RPC_NODE_HTTPS_URL        = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_full_node_url-NBKUCq"
        LAYER2_RPC_NODE_WSS_URL          = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_full_node_wss_url-4RtEaG"
        HUB_AUTH_SECRET                  = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_hub_auth_secret-50oF6K"
        DISCORD_ON_CALL_INTERNAL_WEBHOOK = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_discord_on_call_internal_webhook-4ylxfM"
        PAGERDUTY_TOKEN                  = "arn:aws:secretsmanager:us-east-1:680542703984:secret:PAGERDUTY_TOKEN-kTxFxL"
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
        repository = "hub-event-listener-staging"
        tag        = "latest"
      }
    }
  }

  deploy {
    use "aws-ecs" {
      region              = "us-east-1"
      memory              = "512"
      cluster             = "hub-event-listener-staging"
      count               = 1
      subnets             = ["subnet-09af2ce7fb316890b", "subnet-08c7d485ed397ca69"]
      task_role_name      = "hub-staging-ecr-task"
      execution_role_name = "hub-staging-ecr-task-executor-role"
      disable_alb         = true

      secrets = {
        LAYER1_RPC_NODE_HTTPS_URL        = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_infura_https_url-aCpG9I"
        LAYER1_RPC_NODE_WSS_URL          = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_infura_wss_url-eirZPn"
        LAYER2_RPC_NODE_HTTPS_URL        = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_full_node_url-NBKUCq"
        LAYER2_RPC_NODE_WSS_URL          = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_full_node_wss_url-4RtEaG"
        HUB_AUTH_SECRET                  = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_hub_auth_secret-50oF6K"
        DISCORD_ON_CALL_INTERNAL_WEBHOOK = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_discord_on_call_internal_webhook-4ylxfM"
        PAGERDUTY_TOKEN                  = "arn:aws:secretsmanager:us-east-1:680542703984:secret:PAGERDUTY_TOKEN-kTxFxL"
      }
    }

    hook {
      when    = "after"
      command = ["node", "./scripts/wait-service-stable.mjs", "hub-event-listener"]
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
      region              = "us-east-1"
      memory              = "512"
      count               = 1
      cluster             = "cardie"
      subnets             = ["subnet-89968ba2"]
      task_role_name      = "cardie-ecr-task"
      execution_role_name = "cardie-ecr-task-executor-role"
      disable_alb         = true

      secrets = {
        DISCORD_TOKEN = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_discord_token-g5tbvH"
        GITHUB_TOKEN  = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_github_token-sJaf5H"
      }
    }

    hook {
      when    = "after"
      command = ["node", "./scripts/wait-service-stable.mjs", "cardie"]
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
      region              = "us-east-1"
      memory              = "512"
      cluster             = "cardpay-staging-subgraph-extraction"
      count               = 1
      subnets             = ["subnet-081966e0d7a798bc1", "subnet-0544a2e18d66d0040"]
      task_role_name      = "cardpay-staging-subgraph-extraction-ecr-task"
      execution_role_name = "cardpay-staging-subgraph-extraction-ecr-task-executor-role"

      secrets = {
        SE_DATABASE_STRING = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_subg_extract_database_url-kLIcg4"
        SE_OUTPUT_LOCATION = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_subg_extract_output_location-P04N4G"
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
        repository = "ssr-web-staging"
        tag        = "latest"
      }
    }
  }

  deploy {
    use "aws-ecs" {
      service_port   = 4000
      region         = "us-east-1"
      memory         = "512"
      cluster        = "ssr-web-staging"
      count          = 2
      subnets        = ["subnet-09af2ce7fb316890b", "subnet-08c7d485ed397ca69"]
      task_role_name = "ssr-web-staging-ecr-task"

      alb {
        certificate = "arn:aws:acm:us-east-1:680542703984:certificate/8b232d17-3bb7-41f5-abc0-7b32b0d5190c"
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
      ENVIRONMENT           = "staging"
      REWARD_POOL_ADDRESS   = "0xc9A238Ee71A65554984234DF9721dbdA873F84FA"
      REWARD_PROGRAM_OUTPUT = "s3://cardpay-staging-reward-programs/"
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
        EVM_FULL_NODE_URL = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_full_node_url-NBKUCq"
        OWNER             = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_reward_root_submitter_address-5zx4lK"
        OWNER_PRIVATE_KEY = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_reward_root_submitter_private_key-4BFs6t"
        SENTRY_DSN        = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_reward_root_submitter_sentry_dsn-npg871"
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
      ENVIRONMENT    = "staging"
      REWARDS_BUCKET = "s3://cardpay-staging-reward-programs"
      SUBGRAPH_URL   = "https://graph-staging.stack.cards/subgraphs/name/habdelra/cardpay-sokol"
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
      subnets             = ["subnet-004c18e7177f0a9a2", "subnet-053fc89a829849140"]
      task_role_name      = "reward-api-ecs-task"
      execution_role_name = "reward-api-ecs-task-execution"

      alb {
        certificate = "arn:aws:acm:us-east-1:680542703984:certificate/b8ba590b-e901-4e52-8a79-dcf3c8d8e48a"
      }

      secrets = {
        DB_STRING  = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_reward_api_database_url-dF3FDU"
        SENTRY_DSN = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_reward_api_sentry_dsn-Ugaqpm"
        EVM_FULL_NODE_URL = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_full_node_url-NBKUCq"
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
      ENVIRONMENT    = "staging"
      REWARDS_BUCKET = "s3://cardpay-staging-reward-programs"
      SUBGRAPH_URL   = "https://graph-staging.stack.cards/subgraphs/name/habdelra/cardpay-sokol"
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
      subnets             = ["subnet-004c18e7177f0a9a2", "subnet-053fc89a829849140"]
      task_role_name      = "reward-indexer-ecs-task"
      execution_role_name = "reward-indexer-ecs-task-execution"
      disable_alb         = true

      secrets = {
        DB_STRING  = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_reward_api_database_url-dF3FDU"
        SENTRY_DSN = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_reward_api_sentry_dsn-Ugaqpm"
      }
    }

    hook {
      when    = "after"
      command = ["node", "./scripts/wait-service-stable.mjs", "reward-api"]
    }
  }
}

app "reward-scheduler" {
  path = "./packages/cardpay-reward-scheduler"

  config {
    env = {
      ENVIRONMENT    = "staging"
      REWARDS_BUCKET = "s3://cardpay-staging-reward-programs"
      SUBGRAPH_URL   = "https://graph-staging.stack.cards/subgraphs/name/habdelra/cardpay-sokol"
      REWARD_SCHEDULER_APPROVED_PROGRAMS = "0x2F57D4cf81c87A92dd5f0686fEc6e02887662d07,0x5E4E148baae93424B969a0Ea67FF54c315248BbA"
      REWARD_MANAGER_ADDRESS = "0xaC47B293f836F3a64eb4AEF02Cb7d1428dCe815f"
      REWARDS_SUBGRAPH_EXTRACTION = "s3://cardpay-staging-partitioned-graph-data/data/rewards/0.0.2/"
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
        repository = "cardpay-reward-scheduler-staging"
        tag        = "latest"
      }
    }
  }

  deploy {
    use "aws-ecs" {
      region              = "us-east-1"
      memory              = "512"
      cluster             = "cardpay-reward-scheduler-staging"
      count               = 1
      subnets             = ["subnet-004c18e7177f0a9a2", "subnet-053fc89a829849140"]
      task_role_name      = "reward-programs-scheduler-ecr-task"
      execution_role_name = "reward-programs-scheduler-ecr-task-executor-role"
      disable_alb         = true

      secrets = {
        SENTRY_DSN = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_reward_programs_sentry_dsn-zAMOFo"
        EVM_FULL_NODE_URL = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_full_node_url-NBKUCq"
      }
    }
  }
}
