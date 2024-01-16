project = "cardstack"

# Labels can be specified for organizational purposes.
# labels = { "foo" = "bar" }

app "reward-submit-lambda" {
  path = "./packages/reward-root-submitter"

  build {
    use "docker" {
      dockerfile = "Dockerfile"
      buildkit   = true
      platform   = "linux/amd64"
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
