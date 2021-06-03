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
                listener_arn = "arn:aws:elasticloadbalancing:us-east-1:680542703984:listener/app/hub-staging/c6e5a0b971186e25/593e42aff49acf49"
            }
        }
    }
}
