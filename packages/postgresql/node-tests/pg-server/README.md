This builds a Docker image that we can use for testing against postgresql.

It's published as the image `cardstack/pg-test`. You can rebuild and republish it via:

`docker build . -t cardstack/pg-test`
`docker push cardstack/pg-test`
