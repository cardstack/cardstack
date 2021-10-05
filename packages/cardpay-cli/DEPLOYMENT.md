# Deployment

The Cardpay CLI deployment involves creating a standalone package for the cardpay CLI and uploading the package and an installer to the s3 bucket that holds our installers.

1. Ensure that we publish recent sibling workspaces updates to npm, as the process for creating a standalone package will download all the dependencies from npm.
2. From the packages/cardpay-cli workspace run:
   ```sh
   $ AWS_PROFILE=cardstack-prod yarn pub
   ```
   Where the cardstack-prod credentials point to our production AWS environment. This step will create the standalone package and upload the package and the installer to s3 as well as invalidate the cloudfront cache for the updated assets.