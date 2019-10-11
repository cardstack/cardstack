# Deploy Package

This is not a yarn workspace, meaning it has its own yarn.lock and doesn't get its dependencies installed automatically when you run `yarn` at the top of the project. That's intentional -- it allows travis to install _only_ this package's dependencies, which is the minimal set needed to do the rest of the work/installed inside docker containers.

Mostly this will only matter if you are trying to test deployment locally. You will need to manually run `yarn install` here.