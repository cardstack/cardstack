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
      service_port        = 3000
      region              = "us-east-1"
      cpu                 = "512"
      memory              = "1024"
      cluster             = "hub-prod"
      count               = 2
      subnets             = ["subnet-0c22641bd41cbdd1e", "subnet-01d36d7bcd0334fc0"]
      task_role_name      = "hub-ecs-task"
      execution_role_name = "hub-ecs-task-execution"
      security_group_ids  = ["sg-098518120fd2269f8"]

      alb {
        certificate = "arn:aws:acm:us-east-1:120317779495:certificate/20f287dd-ba3c-4175-8b06-5c3b1e75f6d9"
        subnets     = ["subnet-01d36d7bcd0334fc0", "subnet-0c22641bd41cbdd1e"]
      }

      static_environment = {
        NETWORK            = "xdai"
        ENVIRONMENT        = "production"
        NODE_CONFIG_ENV    = "production"
        HUB_ENVIRONMENT    = "production"
        HUB_AWS_ACCOUNT_ID = "120317779495"
      }

      secrets = {
        # parameter store
        CARDBOT_TOKEN         = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/CARDBOT_TOKEN"
        FIREBASE_CLIENT_EMAIL = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/FIREBASE_CLIENT_EMAIL"
        FIREBASE_DATABASE_URL = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/FIREBASE_DATABASE_URL"
        FIREBASE_PRIVATE_KEY  = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/FIREBASE_PRIVATE_KEY"
        FIREBASE_PROJECT_ID   = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/FIREBASE_PROJECT_ID"
        FIXER_API_KEY         = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/FIXER_API_KEY"
        HUB_DATABASE_URL      = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/HUB_DATABASE_URL"
        HUB_SENTRY_DSN        = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/HUB_SENTRY_DSN"
        PROVISIONER_SECRET    = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/PROVISIONER_SECRET"
        STATUSPAGE_API_KEY    = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/STATUSPAGE_API_KEY"
        STATUSPAGE_PAGE_ID    = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/STATUSPAGE_PAGE_ID"
        WEB3_STORAGE_TOKEN    = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/WEB3_STORAGE_TOKEN"
        WYRE_ACCOUNT_ID       = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/WYRE_ACCOUNT_ID"
        WYRE_API_KEY          = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/WYRE_API_KEY"
        WYRE_SECRET_KEY       = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/WYRE_SECRET_KEY"
        ETHEREUM_RELAYER_ABOUT_PAGE_SECRET = "arn:aws:ssm:us-east-1:120317779495:parameter/production/safe-relay/ethereum/about_page_secret"
        POLYGON_RELAYER_ABOUT_PAGE_SECRET  = "arn:aws:ssm:us-east-1:120317779495:parameter/production/safe-relay/polygon/about_page_secret"

        # secrets manager
        CHECKLY_WEBHOOK_SECRET                        = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_hub_checkly_webhook_secret-1VZEgk"
        CRYPTOCOMPARE_API_KEY                         = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_CRYPTOCOMPARE_API_KEY-c9yTJ9"
        DISCORD_ON_CALL_INTERNAL_WEBHOOK              = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_discord_on_call_internal_webhook-n7SCZC"
        ETHEREUM_GAS_STATION_URL                      = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_ethereum_gas_station_url-tVEK2G"
        ETHEREUM_RPC_NODE_HTTPS_URL                   = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_ethereum_infura_https_url-9fE3dF"
        ETHEREUM_RPC_NODE_WSS_URL                     = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_ethereum_infura_wss_url-rH3BDy"
        GNOSIS_GAS_STATION_URL                        = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_gnosis_gas_station_url-HQGlfM"
        GNOSIS_RPC_NODE_HTTPS_URL                     = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_gnosis_https_url-G4nICS"
        GNOSIS_RPC_NODE_WSS_URL                       = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_gnosis_wss_url-PWACaa"
        HUB_AUTH_SECRET                               = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_hub_auth_secret-amva1E"
        HUB_DATABASE_URL                              = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/HUB_DATABASE_URL"
        HUB_EMAIL_CARD_DROP_RATE_LIMIT_COUNT          = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_hub_email_card_drop_rate_limit_count-mdtxRC"
        HUB_EMAIL_CARD_DROP_RATE_LIMIT_PERIOD_MINUTES = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_hub_email_card_drop_rate_limit_period_minutes-m71GVI"
        HUB_EMAIL_HASH_SALT                           = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_hub_email_hash_salt-6j6HZV"
        HUB_GOOGLE_IAP_SERVICE_ACCOUNT                = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_hub_google_iap_service_account-sePWyQ"
        HUB_PRIVATE_KEY                               = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_hub_private_key-F89030"
        HUB_STORAGE_CLOUDFRONT_DISTRIBUTION           = "arn:aws:secretsmanager:us-east-1:120317779495:secret:hub_storage_cloudfront_distribution-UQfA6A"
        LAYER1_RPC_NODE_HTTPS_URL                     = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_infura_https_url-p9kYAu"
        LAYER1_RPC_NODE_WSS_URL                       = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_infura_wss_url-cTukZK"
        LAYER2_RPC_NODE_HTTPS_URL                     = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_full_node_url-K67DON"
        LAYER2_RPC_NODE_WSS_URL                       = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_full_node_wss_url-BXGFlG"
        MAILCHIMP_API_KEY                             = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_MAILCHIMP_API_KEY-XCGDUW"
        PAGERDUTY_TOKEN                               = "arn:aws:secretsmanager:us-east-1:120317779495:secret:PAGERDUTY_TOKEN-1L68JJ"
        POLYGON_GAS_STATION_URL                       = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_polygon_gas_station_url-j7D7GO"
        POLYGON_RPC_NODE_HTTPS_URL                    = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_polygon_infura_https_url-DlBN06"
        POLYGON_RPC_NODE_WSS_URL                      = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_polygon_infura_wss_url-ErLq0E"
        POLYGON_HUB_RPC_NODE_HTTPS_URL                = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_hub_polygon_https_url-jIVW87"
        ETHEREUM_HUB_RPC_NODE_HTTPS_URL               = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_hub_mainnet_https_url-jRtxEP"
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
      task_role_name      = "hub-worker-ecs-task"
      execution_role_name = "hub-worker-ecs-task-execution"
      security_group_ids  = ["sg-03ae615bbcfa87393"]
      disable_alb         = true

      static_environment = {
        NETWORK            = "xdai"
        ENVIRONMENT        = "production"
        NODE_CONFIG_ENV    = "production"
        HUB_ENVIRONMENT    = "production"
        HUB_AWS_ACCOUNT_ID = "120317779495"
      }

      secrets = {
        # parameter store
        CARDBOT_TOKEN         = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/CARDBOT_TOKEN"
        FIREBASE_CLIENT_EMAIL = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/FIREBASE_CLIENT_EMAIL"
        FIREBASE_DATABASE_URL = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/FIREBASE_DATABASE_URL"
        FIREBASE_PRIVATE_KEY  = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/FIREBASE_PRIVATE_KEY"
        FIREBASE_PROJECT_ID   = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/FIREBASE_PROJECT_ID"
        HUB_DATABASE_URL      = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/HUB_DATABASE_URL"
        HUB_SENTRY_DSN        = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/HUB_SENTRY_DSN"
        PROVISIONER_SECRET    = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/PROVISIONER_SECRET"
        STATUSPAGE_API_KEY    = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/STATUSPAGE_API_KEY"
        STATUSPAGE_PAGE_ID    = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/STATUSPAGE_PAGE_ID"
        WEB3_STORAGE_TOKEN    = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/WEB3_STORAGE_TOKEN"
        WYRE_ACCOUNT_ID       = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/WYRE_ACCOUNT_ID"
        WYRE_API_KEY          = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/WYRE_API_KEY"
        WYRE_SECRET_KEY       = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/WYRE_SECRET_KEY"

        # secrets manager
        DISCORD_ON_CALL_INTERNAL_WEBHOOK    = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_discord_on_call_internal_webhook-n7SCZC"
        ETHEREUM_GAS_STATION_URL            = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_ethereum_gas_station_url-tVEK2G"
        ETHEREUM_RPC_NODE_HTTPS_URL         = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_ethereum_infura_https_url-9fE3dF"
        ETHEREUM_RPC_NODE_WSS_URL           = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_ethereum_infura_wss_url-rH3BDy"
        GNOSIS_GAS_STATION_URL              = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_gnosis_gas_station_url-HQGlfM"
        GNOSIS_RPC_NODE_HTTPS_URL           = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_gnosis_https_url-G4nICS"
        GNOSIS_RPC_NODE_WSS_URL             = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_gnosis_wss_url-PWACaa"
        HUB_AUTH_SECRET                     = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_hub_auth_secret-amva1E"
        HUB_DATABASE_URL                    = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/HUB_DATABASE_URL"
        HUB_PRIVATE_KEY                     = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_hub_private_key-F89030"
        HUB_STORAGE_CLOUDFRONT_DISTRIBUTION = "arn:aws:secretsmanager:us-east-1:120317779495:secret:hub_storage_cloudfront_distribution-UQfA6A"
        LAYER1_RPC_NODE_HTTPS_URL           = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_infura_https_url-p9kYAu"
        LAYER1_RPC_NODE_WSS_URL             = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_infura_wss_url-cTukZK"
        LAYER2_RPC_NODE_HTTPS_URL           = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_full_node_url-K67DON"
        LAYER2_RPC_NODE_WSS_URL             = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_full_node_wss_url-BXGFlG"
        MAILCHIMP_API_KEY                   = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_MAILCHIMP_API_KEY-XCGDUW"
        PAGERDUTY_TOKEN                     = "arn:aws:secretsmanager:us-east-1:120317779495:secret:PAGERDUTY_TOKEN-1L68JJ"
        POLYGON_GAS_STATION_URL             = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_polygon_gas_station_url-j7D7GO"
        POLYGON_RPC_NODE_HTTPS_URL          = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_polygon_infura_https_url-DlBN06"
        POLYGON_RPC_NODE_WSS_URL            = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_polygon_infura_wss_url-ErLq0E"
        POLYGON_HUB_RPC_NODE_HTTPS_URL      = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_hub_polygon_https_url-jIVW87"
        ETHEREUM_HUB_RPC_NODE_HTTPS_URL     = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_hub_mainnet_https_url-jRtxEP"
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
      task_role_name      = "hub-bot-ecs-task"
      execution_role_name = "hub-bot-ecs-task-execution"
      security_group_ids  = ["sg-003ba9cd5594cbcc2"]
      disable_alb         = true

      static_environment = {
        NETWORK            = "xdai"
        ENVIRONMENT        = "production"
        NODE_CONFIG_ENV    = "production"
        HUB_ENVIRONMENT    = "production"
        HUB_AWS_ACCOUNT_ID = "120317779495"
      }

      secrets = {
        # parameter store
        CARDBOT_TOKEN         = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/CARDBOT_TOKEN"
        FIREBASE_CLIENT_EMAIL = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/FIREBASE_CLIENT_EMAIL"
        FIREBASE_DATABASE_URL = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/FIREBASE_DATABASE_URL"
        FIREBASE_PRIVATE_KEY  = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/FIREBASE_PRIVATE_KEY"
        FIREBASE_PROJECT_ID   = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/FIREBASE_PROJECT_ID"
        HUB_DATABASE_URL      = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/HUB_DATABASE_URL"
        HUB_SENTRY_DSN        = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/HUB_SENTRY_DSN"
        PROVISIONER_SECRET    = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/PROVISIONER_SECRET"
        STATUSPAGE_API_KEY    = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/STATUSPAGE_API_KEY"
        STATUSPAGE_PAGE_ID    = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/STATUSPAGE_PAGE_ID"
        WEB3_STORAGE_TOKEN    = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/WEB3_STORAGE_TOKEN"
        WYRE_ACCOUNT_ID       = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/WYRE_ACCOUNT_ID"
        WYRE_API_KEY          = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/WYRE_API_KEY"
        WYRE_SECRET_KEY       = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/WYRE_SECRET_KEY"

        # secrets manager
        DISCORD_ON_CALL_INTERNAL_WEBHOOK = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_discord_on_call_internal_webhook-n7SCZC"
        ETHEREUM_GAS_STATION_URL         = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_ethereum_gas_station_url-tVEK2G"
        ETHEREUM_RPC_NODE_HTTPS_URL      = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_ethereum_infura_https_url-9fE3dF"
        ETHEREUM_RPC_NODE_WSS_URL        = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_ethereum_infura_wss_url-rH3BDy"
        GNOSIS_GAS_STATION_URL           = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_gnosis_gas_station_url-HQGlfM"
        GNOSIS_RPC_NODE_HTTPS_URL        = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_gnosis_https_url-G4nICS"
        GNOSIS_RPC_NODE_WSS_URL          = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_gnosis_wss_url-PWACaa"
        HUB_AUTH_SECRET                  = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_hub_auth_secret-amva1E"
        HUB_DATABASE_URL                 = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/HUB_DATABASE_URL"
        HUB_PRIVATE_KEY                  = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_hub_private_key-F89030"
        LAYER1_RPC_NODE_HTTPS_URL        = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_infura_https_url-p9kYAu"
        LAYER1_RPC_NODE_WSS_URL          = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_infura_wss_url-cTukZK"
        LAYER2_RPC_NODE_HTTPS_URL        = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_full_node_url-K67DON"
        LAYER2_RPC_NODE_WSS_URL          = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_full_node_wss_url-BXGFlG"
        PAGERDUTY_TOKEN                  = "arn:aws:secretsmanager:us-east-1:120317779495:secret:PAGERDUTY_TOKEN-1L68JJ"
        POLYGON_GAS_STATION_URL          = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_polygon_gas_station_url-j7D7GO"
        POLYGON_RPC_NODE_HTTPS_URL       = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_polygon_infura_https_url-DlBN06"
        POLYGON_RPC_NODE_WSS_URL         = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_polygon_infura_wss_url-ErLq0E"
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
      task_role_name      = "hub-event-listener-ecs-task"
      execution_role_name = "hub-event-listener-ecs-task-execution"
      security_group_ids  = ["sg-09b022c7166e01262"]
      disable_alb         = true

      static_environment = {
        NETWORK            = "xdai"
        ENVIRONMENT        = "production"
        NODE_CONFIG_ENV    = "production"
        HUB_ENVIRONMENT    = "production"
        HUB_AWS_ACCOUNT_ID = "120317779495"
      }

      secrets = {
        # parameter store
        CARDBOT_TOKEN         = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/CARDBOT_TOKEN"
        FIREBASE_CLIENT_EMAIL = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/FIREBASE_CLIENT_EMAIL"
        FIREBASE_DATABASE_URL = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/FIREBASE_DATABASE_URL"
        FIREBASE_PRIVATE_KEY  = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/FIREBASE_PRIVATE_KEY"
        FIREBASE_PROJECT_ID   = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/FIREBASE_PROJECT_ID"
        HUB_DATABASE_URL      = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/HUB_DATABASE_URL"
        HUB_SENTRY_DSN        = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/HUB_SENTRY_DSN"
        PROVISIONER_SECRET    = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/PROVISIONER_SECRET"
        STATUSPAGE_API_KEY    = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/STATUSPAGE_API_KEY"
        STATUSPAGE_PAGE_ID    = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/STATUSPAGE_PAGE_ID"
        WEB3_STORAGE_TOKEN    = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/WEB3_STORAGE_TOKEN"
        WYRE_ACCOUNT_ID       = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/WYRE_ACCOUNT_ID"
        WYRE_API_KEY          = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/WYRE_API_KEY"
        WYRE_SECRET_KEY       = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/WYRE_SECRET_KEY"

        # secrets manager
        DISCORD_ON_CALL_INTERNAL_WEBHOOK = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_discord_on_call_internal_webhook-n7SCZC"
        ETHEREUM_GAS_STATION_URL         = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_ethereum_gas_station_url-tVEK2G"
        ETHEREUM_RPC_NODE_HTTPS_URL      = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_ethereum_infura_https_url-9fE3dF"
        ETHEREUM_RPC_NODE_WSS_URL        = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_ethereum_infura_wss_url-rH3BDy"
        GNOSIS_GAS_STATION_URL           = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_gnosis_gas_station_url-HQGlfM"
        GNOSIS_RPC_NODE_HTTPS_URL        = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_gnosis_https_url-G4nICS"
        GNOSIS_RPC_NODE_WSS_URL          = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_gnosis_wss_url-PWACaa"
        HUB_AUTH_SECRET                  = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_hub_auth_secret-amva1E"
        HUB_DATABASE_URL                 = "arn:aws:ssm:us-east-1:120317779495:parameter/production/hub/HUB_DATABASE_URL"
        HUB_PRIVATE_KEY                  = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_hub_private_key-F89030"
        LAYER1_RPC_NODE_HTTPS_URL        = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_infura_https_url-p9kYAu"
        LAYER1_RPC_NODE_WSS_URL          = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_infura_wss_url-cTukZK"
        LAYER2_RPC_NODE_HTTPS_URL        = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_full_node_url-K67DON"
        LAYER2_RPC_NODE_WSS_URL          = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_full_node_wss_url-BXGFlG"
        PAGERDUTY_TOKEN                  = "arn:aws:secretsmanager:us-east-1:120317779495:secret:PAGERDUTY_TOKEN-1L68JJ"
        POLYGON_GAS_STATION_URL          = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_polygon_gas_station_url-j7D7GO"
        POLYGON_RPC_NODE_HTTPS_URL       = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_polygon_infura_https_url-DlBN06"
        POLYGON_RPC_NODE_WSS_URL         = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_polygon_infura_wss_url-ErLq0E"
        POLYGON_HUB_RPC_NODE_HTTPS_URL   = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_hub_polygon_https_url-jIVW87"
        ETHEREUM_HUB_RPC_NODE_HTTPS_URL   = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_hub_mainnet_https_url-jRtxEP"
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
      task_role_name      = "cardpay-subg-ext-ecs-task"
      execution_role_name = "cardpay-subg-ext-ecs-task-execution"
      security_group_ids  = ["sg-08a9f0f453e7e7a43"]

      static_environment = {
        ENVIRONMENT = "production"
      }

      secrets = {
        SE_DATABASE_STRING = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_subg_extract_database_url-5HyPh7"
        SE_OUTPUT_LOCATION = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_subg_extract_output_location-YDoQUt"
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
        repository = "ssr-web-prod"
        tag        = "latest"
      }
    }
  }

  deploy {
    use "aws-ecs" {
      service_port        = 4000
      region              = "us-east-1"
      memory              = "512"
      cluster             = "ssr-web-prod"
      count               = 2
      subnets             = ["subnet-0c22641bd41cbdd1e", "subnet-01d36d7bcd0334fc0"]
      security_group_ids  = ["sg-0c8b6a2abf52d009a"]
      task_role_name      = "ssr-web-ecs-task"
      execution_role_name = "ssr-web-ecs-task-execution"

      alb {
        subnets     = ["subnet-0c22641bd41cbdd1e", "subnet-01d36d7bcd0334fc0"]
        certificate = "arn:aws:acm:us-east-1:120317779495:certificate/e1d6a1c7-456e-4058-b90b-9c603a65734d"
      }

      static_environment = {
        ENVIRONMENT         = "production"
        SSR_WEB_ENVIRONMENT = "production"
      }

      secrets = {
        SSR_WEB_SERVER_SENTRY_DSN = "arn:aws:ssm:us-east-1:120317779495:parameter/production/ssr-web/SSR_WEB_SERVER_SENTRY_DSN"
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
    }

    static_environment = {
      ENVIRONMENT = "production"
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
      task_role_name      = "reward-scheduler-ecs-task"
      execution_role_name = "reward-scheduler-ecs-task-execution"
      subnets             = ["subnet-095ad696012f6ed6c"]
      security_group_ids  = ["sg-0f85bb50306fe067e"]
      disable_alb         = true

      static_environment = {
        ENVIRONMENT                        = "production"
        REWARDS_BUCKET                     = "s3://cardpay-production-reward-programs"
        SUBGRAPH_URL                       = "https://graph.cardstack.com/subgraphs/name/habdelra/cardpay-xdai"
        REWARD_SCHEDULER_APPROVED_PROGRAMS = "0x979C9F171fb6e9BC501Aa7eEd71ca8dC27cF1185"
        REWARD_MANAGER_ADDRESS             = "0xDbAe2bC81bFa4e46df43a34403aAcde5FFdB2A9D"
        REWARDS_SUBGRAPH_EXTRACTION        = "s3://cardpay-production-partitioned-graph-data/data/rewards/0.0.2/"
        REWARD_SCHEDULER_UPDATE_FREQUENCY  = "600"
      }

      secrets = {
        SENTRY_DSN        = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_reward_programs_sentry_dsn-lsCwEe"
        EVM_FULL_NODE_URL = "arn:aws:secretsmanager:us-east-1:120317779495:secret:production_evm_full_node_url-K67DON"
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
