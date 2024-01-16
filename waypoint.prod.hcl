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
    }

    static_environment = {
      ENVIRONMENT = "production"
    }
  }

  url {
    auto_hostname = false
  }
}
