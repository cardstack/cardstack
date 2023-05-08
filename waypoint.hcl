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
      service_port        = 3000
      region              = "us-east-1"
      memory              = "512"
      cluster             = "hub-staging"
      count               = 2
      subnets             = ["subnet-09af2ce7fb316890b", "subnet-08c7d485ed397ca69"]
      task_role_name      = "hub-ecs-task"
      execution_role_name = "hub-ecs-task-execution"
      security_group_ids  = ["sg-036935079377197d1"]

      alb {
        subnets     = ["subnet-09af2ce7fb316890b", "subnet-08c7d485ed397ca69"]
        certificate = "arn:aws:acm:us-east-1:680542703984:certificate/f7de489d-e9fc-4191-8b85-efab3eda9a7f"
      }

      static_environment = {
        NETWORK            = "sokol"
        ENVIRONMENT        = "staging"
        NODE_CONFIG_ENV    = "staging"
        HUB_ENVIRONMENT    = "staging"
        HUB_AWS_ACCOUNT_ID = "680542703984"
      }

      secrets = {
        # parameter store
        CARDBOT_TOKEN         = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/CARDBOT_TOKEN"
        FIREBASE_CLIENT_EMAIL = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/FIREBASE_CLIENT_EMAIL"
        FIREBASE_DATABASE_URL = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/FIREBASE_DATABASE_URL"
        FIREBASE_PRIVATE_KEY  = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/FIREBASE_PRIVATE_KEY"
        FIREBASE_PROJECT_ID   = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/FIREBASE_PROJECT_ID"
        FIXER_API_KEY         = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/FIXER_API_KEY"
        HUB_DATABASE_URL      = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/HUB_DATABASE_URL"
        HUB_SENTRY_DSN        = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/HUB_SENTRY_DSN"
        PROVISIONER_SECRET    = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/PROVISIONER_SECRET"
        WEB3_STORAGE_TOKEN    = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/WEB3_STORAGE_TOKEN"
        WYRE_ACCOUNT_ID       = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/WYRE_ACCOUNT_ID"
        WYRE_API_KEY          = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/WYRE_API_KEY"
        WYRE_SECRET_KEY       = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/WYRE_SECRET_KEY"
        GOERLI_RELAYER_ABOUT_PAGE_SECRET = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/safe-relay/goerli/about_page_secret"

        # secrets manager
        CHECKLY_WEBHOOK_SECRET                        = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_hub_checkly_webhook_secret-etKeUa"
        CRYPTOCOMPARE_API_KEY                         = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_CRYPTOCOMPARE_API_KEY-3Sk0nr"
        DISCORD_ON_CALL_INTERNAL_WEBHOOK              = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_discord_on_call_internal_webhook-4ylxfM"
        ETHEREUM_GAS_STATION_URL                      = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_ethereum_gas_station_url-AlItsC"
        ETHEREUM_RPC_NODE_HTTPS_URL                   = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_ethereum_infura_https_url-okgckW"
        ETHEREUM_RPC_NODE_WSS_URL                     = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_ethereum_infura_wss_url-hXLd7Q"
        GNOSIS_GAS_STATION_URL                        = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_gnosis_gas_station_url-0xbRlJ"
        GNOSIS_RPC_NODE_HTTPS_URL                     = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_gnosis_https_url-U4pZOp"
        GNOSIS_RPC_NODE_WSS_URL                       = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_gnosis_wss_url-mwHYYq"
        HUB_AUTH_SECRET                               = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_hub_auth_secret-50oF6K"
        HUB_EMAIL_CARD_DROP_RATE_LIMIT_COUNT          = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_hub_email_card_drop_rate_limit_count-RdAViY"
        HUB_EMAIL_CARD_DROP_RATE_LIMIT_PERIOD_MINUTES = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_hub_email_card_drop_rate_limit_period_minutes-UKgldx"
        HUB_EMAIL_HASH_SALT                           = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_hub_email_hash_salt-nJvKQH"
        HUB_GOOGLE_IAP_SERVICE_ACCOUNT                = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_hub_google_iap_service_account-v0PB3u"
        HUB_PRIVATE_KEY                               = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_hub_private_key-fJhPUj"
        LAYER1_RPC_NODE_HTTPS_URL                     = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_infura_https_url-aCpG9I"
        LAYER1_RPC_NODE_WSS_URL                       = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_infura_wss_url-eirZPn"
        LAYER2_RPC_NODE_HTTPS_URL                     = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_full_node_url-NBKUCq"
        LAYER2_RPC_NODE_WSS_URL                       = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_full_node_wss_url-4RtEaG"
        MAILCHIMP_API_KEY                             = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_MAILCHIMP_API_KEY-lkxsEk"
        PAGERDUTY_TOKEN                               = "arn:aws:secretsmanager:us-east-1:680542703984:secret:PAGERDUTY_TOKEN-kTxFxL"
        POLYGON_GAS_STATION_URL                       = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_polygon_gas_station_url-cUpbHc"
        POLYGON_RPC_NODE_HTTPS_URL                    = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_polygon_infura_https_url-wIF3tU"
        POLYGON_RPC_NODE_WSS_URL                      = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_polygon_infura_wss_url-UvdYiF"
        POLYGON_HUB_RPC_NODE_HTTPS_URL                = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_polygon_infura_https_url-wIF3tU"
        ETHEREUM_HUB_RPC_NODE_HTTPS_URL               = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_infura_https_url-aCpG9I"

        # The below is a distribution in the production AWS account
        HUB_STORAGE_CLOUDFRONT_DISTRIBUTION = "arn:aws:secretsmanager:us-east-1:680542703984:secret:hub_storage_cloudfront_distribution-Frtsb3"
      }
    }

    hook {
      when    = "after"
      command = ["node", "./scripts/waypoint-ecs-add-tags.mjs", "hub"]
    }

    hook {
      when    = "after"
      command = ["node", "./scripts/wait-service-stable.mjs", "hub"]
    }
  }

  url {
    auto_hostname = false
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
      task_role_name      = "hub-worker-ecs-task"
      execution_role_name = "hub-worker-ecs-task-execution"
      security_group_ids  = ["sg-0cce1f41f369bf838"]
      disable_alb         = true

      static_environment = {
        NETWORK            = "sokol"
        ENVIRONMENT        = "staging"
        NODE_CONFIG_ENV    = "staging"
        HUB_ENVIRONMENT    = "staging"
        HUB_AWS_ACCOUNT_ID = "680542703984"
      }

      secrets = {
        # parameter store
        CARDBOT_TOKEN         = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/CARDBOT_TOKEN"
        FIREBASE_CLIENT_EMAIL = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/FIREBASE_CLIENT_EMAIL"
        FIREBASE_DATABASE_URL = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/FIREBASE_DATABASE_URL"
        FIREBASE_PRIVATE_KEY  = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/FIREBASE_PRIVATE_KEY"
        FIREBASE_PROJECT_ID   = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/FIREBASE_PROJECT_ID"
        HUB_DATABASE_URL      = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/HUB_DATABASE_URL"
        HUB_SENTRY_DSN        = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/HUB_SENTRY_DSN"
        PROVISIONER_SECRET    = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/PROVISIONER_SECRET"
        WEB3_STORAGE_TOKEN    = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/WEB3_STORAGE_TOKEN"
        WYRE_ACCOUNT_ID       = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/WYRE_ACCOUNT_ID"
        WYRE_API_KEY          = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/WYRE_API_KEY"
        WYRE_SECRET_KEY       = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/WYRE_SECRET_KEY"

        # secrets manager
        DISCORD_ON_CALL_INTERNAL_WEBHOOK = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_discord_on_call_internal_webhook-4ylxfM"
        ETHEREUM_GAS_STATION_URL         = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_ethereum_gas_station_url-AlItsC"
        ETHEREUM_RPC_NODE_HTTPS_URL      = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_ethereum_infura_https_url-okgckW"
        ETHEREUM_RPC_NODE_WSS_URL        = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_ethereum_infura_wss_url-hXLd7Q"
        GNOSIS_GAS_STATION_URL           = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_gnosis_gas_station_url-0xbRlJ"
        GNOSIS_RPC_NODE_HTTPS_URL        = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_gnosis_https_url-U4pZOp"
        GNOSIS_RPC_NODE_WSS_URL          = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_gnosis_wss_url-mwHYYq"
        HUB_AUTH_SECRET                  = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_hub_auth_secret-50oF6K"
        HUB_PRIVATE_KEY                  = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_hub_private_key-fJhPUj"
        LAYER1_RPC_NODE_HTTPS_URL        = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_infura_https_url-aCpG9I"
        LAYER1_RPC_NODE_WSS_URL          = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_infura_wss_url-eirZPn"
        LAYER2_RPC_NODE_HTTPS_URL        = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_full_node_url-NBKUCq"
        LAYER2_RPC_NODE_WSS_URL          = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_full_node_wss_url-4RtEaG"
        MAILCHIMP_API_KEY                = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_MAILCHIMP_API_KEY-lkxsEk"
        PAGERDUTY_TOKEN                  = "arn:aws:secretsmanager:us-east-1:680542703984:secret:PAGERDUTY_TOKEN-kTxFxL"
        POLYGON_GAS_STATION_URL          = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_polygon_gas_station_url-cUpbHc"
        POLYGON_RPC_NODE_HTTPS_URL       = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_polygon_infura_https_url-wIF3tU"
        POLYGON_RPC_NODE_WSS_URL         = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_polygon_infura_wss_url-UvdYiF"
        POLYGON_HUB_RPC_NODE_HTTPS_URL   = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_polygon_infura_https_url-wIF3tU"
        ETHEREUM_HUB_RPC_NODE_HTTPS_URL  = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_infura_https_url-aCpG9I"

        # The below is a distribution in the production AWS account
        HUB_STORAGE_CLOUDFRONT_DISTRIBUTION = "arn:aws:secretsmanager:us-east-1:680542703984:secret:hub_storage_cloudfront_distribution-Frtsb3"
      }
    }

    hook {
      when    = "after"
      command = ["node", "./scripts/waypoint-ecs-add-tags.mjs", "hub-worker"]
    }

    hook {
      when    = "after"
      command = ["node", "./scripts/wait-service-stable.mjs", "hub-worker"]
    }
  }

  url {
    auto_hostname = false
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
      task_role_name      = "hub-bot-ecs-task"
      execution_role_name = "hub-bot-ecs-task-execution"
      security_group_ids  = ["sg-06c858d75273b05d6"]
      disable_alb         = true

      static_environment = {
        ENVIRONMENT        = "staging"
        HUB_ENVIRONMENT    = "staging"
        HUB_AWS_ACCOUNT_ID = "680542703984"
      }

      secrets = {
        # parameter store
        CARDBOT_TOKEN         = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/CARDBOT_TOKEN"
        FIREBASE_CLIENT_EMAIL = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/FIREBASE_CLIENT_EMAIL"
        FIREBASE_DATABASE_URL = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/FIREBASE_DATABASE_URL"
        FIREBASE_PRIVATE_KEY  = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/FIREBASE_PRIVATE_KEY"
        FIREBASE_PROJECT_ID   = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/FIREBASE_PROJECT_ID"
        HUB_DATABASE_URL      = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/HUB_DATABASE_URL"
        HUB_SENTRY_DSN        = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/HUB_SENTRY_DSN"
        PROVISIONER_SECRET    = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/PROVISIONER_SECRET"
        WEB3_STORAGE_TOKEN    = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/WEB3_STORAGE_TOKEN"
        WYRE_ACCOUNT_ID       = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/WYRE_ACCOUNT_ID"
        WYRE_API_KEY          = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/WYRE_API_KEY"
        WYRE_SECRET_KEY       = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/WYRE_SECRET_KEY"

        # secrets manager
        DISCORD_ON_CALL_INTERNAL_WEBHOOK = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_discord_on_call_internal_webhook-4ylxfM"
        ETHEREUM_GAS_STATION_URL         = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_ethereum_gas_station_url-AlItsC"
        ETHEREUM_RPC_NODE_HTTPS_URL      = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_ethereum_infura_https_url-okgckW"
        ETHEREUM_RPC_NODE_WSS_URL        = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_ethereum_infura_wss_url-hXLd7Q"
        GNOSIS_GAS_STATION_URL           = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_gnosis_gas_station_url-0xbRlJ"
        GNOSIS_RPC_NODE_HTTPS_URL        = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_gnosis_https_url-U4pZOp"
        GNOSIS_RPC_NODE_WSS_URL          = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_gnosis_wss_url-mwHYYq"
        HUB_AUTH_SECRET                  = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_hub_auth_secret-50oF6K"
        HUB_PRIVATE_KEY                  = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_hub_private_key-fJhPUj"
        LAYER1_RPC_NODE_HTTPS_URL        = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_infura_https_url-aCpG9I"
        LAYER1_RPC_NODE_WSS_URL          = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_infura_wss_url-eirZPn"
        LAYER2_RPC_NODE_HTTPS_URL        = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_full_node_url-NBKUCq"
        LAYER2_RPC_NODE_WSS_URL          = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_full_node_wss_url-4RtEaG"
        PAGERDUTY_TOKEN                  = "arn:aws:secretsmanager:us-east-1:680542703984:secret:PAGERDUTY_TOKEN-kTxFxL"
        POLYGON_GAS_STATION_URL          = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_polygon_gas_station_url-cUpbHc"
        POLYGON_RPC_NODE_HTTPS_URL       = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_polygon_infura_https_url-wIF3tU"
        POLYGON_RPC_NODE_WSS_URL         = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_polygon_infura_wss_url-UvdYiF"
      }
    }

    hook {
      when    = "after"
      command = ["node", "./scripts/waypoint-ecs-add-tags.mjs", "hub-bot"]
    }

    hook {
      when    = "after"
      command = ["node", "./scripts/wait-service-stable.mjs", "hub-bot"]
    }
  }

  url {
    auto_hostname = false
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
      task_role_name      = "hub-event-listener-ecs-task"
      execution_role_name = "hub-event-listener-ecs-task-execution"
      security_group_ids  = ["sg-02a1b0d7a025fabd0"]
      disable_alb         = true

      static_environment = {
        ENVIRONMENT        = "staging"
        HUB_ENVIRONMENT    = "staging"
        HUB_AWS_ACCOUNT_ID = "680542703984"
      }

      secrets = {
        # parameter store
        CARDBOT_TOKEN         = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/CARDBOT_TOKEN"
        FIREBASE_CLIENT_EMAIL = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/FIREBASE_CLIENT_EMAIL"
        FIREBASE_DATABASE_URL = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/FIREBASE_DATABASE_URL"
        FIREBASE_PRIVATE_KEY  = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/FIREBASE_PRIVATE_KEY"
        FIREBASE_PROJECT_ID   = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/FIREBASE_PROJECT_ID"
        HUB_DATABASE_URL      = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/HUB_DATABASE_URL"
        HUB_SENTRY_DSN        = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/HUB_SENTRY_DSN"
        PROVISIONER_SECRET    = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/PROVISIONER_SECRET"
        WEB3_STORAGE_TOKEN    = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/WEB3_STORAGE_TOKEN"
        WYRE_ACCOUNT_ID       = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/WYRE_ACCOUNT_ID"
        WYRE_API_KEY          = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/WYRE_API_KEY"
        WYRE_SECRET_KEY       = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/hub/WYRE_SECRET_KEY"

        # secrets manager
        DISCORD_ON_CALL_INTERNAL_WEBHOOK = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_discord_on_call_internal_webhook-4ylxfM"
        ETHEREUM_GAS_STATION_URL         = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_ethereum_gas_station_url-AlItsC"
        ETHEREUM_RPC_NODE_HTTPS_URL      = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_ethereum_infura_https_url-okgckW"
        ETHEREUM_RPC_NODE_WSS_URL        = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_ethereum_infura_wss_url-hXLd7Q"
        GNOSIS_GAS_STATION_URL           = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_gnosis_gas_station_url-0xbRlJ"
        GNOSIS_RPC_NODE_HTTPS_URL        = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_gnosis_https_url-U4pZOp"
        GNOSIS_RPC_NODE_WSS_URL          = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_gnosis_wss_url-mwHYYq"
        HUB_AUTH_SECRET                  = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_hub_auth_secret-50oF6K"
        HUB_PRIVATE_KEY                  = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_hub_private_key-fJhPUj"
        LAYER1_RPC_NODE_HTTPS_URL        = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_infura_https_url-aCpG9I"
        LAYER1_RPC_NODE_WSS_URL          = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_infura_wss_url-eirZPn"
        LAYER2_RPC_NODE_HTTPS_URL        = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_full_node_url-NBKUCq"
        LAYER2_RPC_NODE_WSS_URL          = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_full_node_wss_url-4RtEaG"
        PAGERDUTY_TOKEN                  = "arn:aws:secretsmanager:us-east-1:680542703984:secret:PAGERDUTY_TOKEN-kTxFxL"
        POLYGON_GAS_STATION_URL          = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_polygon_gas_station_url-cUpbHc"
        POLYGON_RPC_NODE_HTTPS_URL       = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_polygon_infura_https_url-wIF3tU"
        POLYGON_RPC_NODE_WSS_URL         = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_polygon_infura_wss_url-UvdYiF"
        POLYGON_HUB_RPC_NODE_HTTPS_URL   = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_polygon_infura_https_url-wIF3tU"
        ETHEREUM_HUB_RPC_NODE_HTTPS_URL   = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_infura_https_url-aCpG9I"
      }
    }

    hook {
      when    = "after"
      command = ["node", "./scripts/waypoint-ecs-add-tags.mjs", "hub-event-listener"]
    }

    hook {
      when    = "after"
      command = ["node", "./scripts/wait-service-stable.mjs", "hub-event-listener"]
    }
  }

  url {
    auto_hostname = false
  }
}

# This name has been chosen to be much shorter than 32 characters
# If the name comes close to 32 characters there are unreliable
# deployments. See
#  https://github.com/hashicorp/waypoint/issues/2957
# for more details
app "cardpay-subg-ext" {
  path = "./packages/cardpay-subgraph-extraction"

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
      task_role_name      = "cardpay-subg-ext-ecs-task"
      execution_role_name = "cardpay-subg-ext-ecs-task-execution"
      security_group_ids  = ["sg-02c9224910953df81"]

      static_environment = {
        ENVIRONMENT = "staging"
      }

      secrets = {
        SE_DATABASE_STRING = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_subg_extract_database_url-kLIcg4"
        SE_OUTPUT_LOCATION = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_subg_extract_output_location-P04N4G"
      }

      disable_alb = true
    }

    hook {
      when    = "after"
      command = ["node", "./scripts/waypoint-ecs-add-tags.mjs", "cardpay-subg-ext"]
    }

    hook {
      when    = "after"
      command = ["node", "./scripts/wait-service-stable.mjs", "cardpay-subg-ext"]
    }
  }

  url {
    auto_hostname = false
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
      service_port        = 4000
      region              = "us-east-1"
      memory              = "512"
      cluster             = "ssr-web-staging"
      count               = 2
      subnets             = ["subnet-09af2ce7fb316890b", "subnet-08c7d485ed397ca69"]
      security_group_ids  = ["sg-00c44baca348e403b"]
      task_role_name      = "ssr-web-ecs-task"
      execution_role_name = "ssr-web-ecs-task-execution"

      alb {
        subnets     = ["subnet-09af2ce7fb316890b", "subnet-08c7d485ed397ca69"]
        certificate = "arn:aws:acm:us-east-1:680542703984:certificate/8b232d17-3bb7-41f5-abc0-7b32b0d5190c"
      }

      static_environment = {
        ENVIRONMENT         = "staging"
        SSR_WEB_ENVIRONMENT = "staging"
      }

      secrets = {
        SSR_WEB_SERVER_SENTRY_DSN = "arn:aws:ssm:us-east-1:680542703984:parameter/staging/ssr-web/SSR_WEB_SERVER_SENTRY_DSN"
      }
    }

    hook {
      when    = "after"
      command = ["node", "./scripts/waypoint-ecs-add-tags.mjs", "ssr-web"]
    }

    hook {
      when    = "after"
      command = ["node", "./scripts/wait-service-stable.mjs", "ssr-web"]
    }
  }

  url {
    auto_hostname = false
  }
}

app "reward-submit-lambda" {
  path = "./packages/reward-root-submitter"

  build {
    use "docker" {
      dockerfile = "Dockerfile"
    }

    registry {
      use "aws-ecr" {
        region     = "us-east-1"
        repository = "reward-root-submitter-lambda"
        tag        = "latest"
      }
    }
  }

  deploy {
    use "aws-lambda" {
      region = "us-east-1"

      static_environment = {
        ENVIRONMENT           = "staging"
        REWARD_POOL_ADDRESS   = "0xc9A238Ee71A65554984234DF9721dbdA873F84FA"
        REWARD_PROGRAM_OUTPUT = "s3://cardpay-staging-reward-programs/"
      }
    }
  }

  url {
    auto_hostname = false
  }
}




app "reward-scheduler" {
  path = "./packages/cardpay-reward-scheduler"

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
      subnets             = ["subnet-05906e0970bfd8ed3"]
      task_role_name      = "reward-scheduler-ecs-task"
      execution_role_name = "reward-scheduler-ecs-task-execution"
      security_group_ids  = ["sg-01c1bd7bc5bd314f2", "sg-09e402d0389829be4"]
      disable_alb         = true

      static_environment = {
        ENVIRONMENT                        = "staging"
        REWARDS_BUCKET                     = "s3://cardpay-staging-reward-programs"
        SUBGRAPH_URL                       = "https://graph-staging.stack.cards/subgraphs/name/habdelra/cardpay-sokol"
        REWARD_SCHEDULER_APPROVED_PROGRAMS = "0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72,0xab20c80fcc025451a3fc73bB953aaE1b9f640949"
        REWARD_MANAGER_ADDRESS             = "0xC29EfEa853fb7c781488c70aF9135c853d809147"
        REWARDS_SUBGRAPH_EXTRACTION        = "s3://cardpay-staging-partitioned-graph-data/data/rewards/0.0.2/"
        REWARD_SCHEDULER_UPDATE_FREQUENCY  = "60"
      }

      secrets = {
        SENTRY_DSN        = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_reward_programs_sentry_dsn-zAMOFo"
        EVM_FULL_NODE_URL = "arn:aws:secretsmanager:us-east-1:680542703984:secret:staging_evm_full_node_url-NBKUCq"
      }
    }

    hook {
      when    = "after"
      command = ["node", "./scripts/waypoint-ecs-add-tags.mjs", "reward-scheduler"]
    }

    hook {
      when    = "after"
      command = ["node", "./scripts/wait-service-stable.mjs", "reward-scheduler"]
    }
  }

  url {
    auto_hostname = false
  }
}
