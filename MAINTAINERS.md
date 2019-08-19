# Maintainers

This document is for project maintainers who are doing versioning, releases, and publishing for the cardstack mono-repo.

## Updating package versions

The versions of all packages in the mono-repo are updated at the same time, to the same version number.

1. Get the latest code on master and create a branch. `git checkout master`, `git pull origin master`, `git checkout -b vX.Y.Z`
2. Look at the `git log` since the last release, and list anything significant in the `CHANGELOG.md`.
Determine whether the release should be a major (breaking) or minor (non-breaking).
For breaking releases, include upgrade instructions in the changelog.
3. Commit the changes, make sure your working tree is clean, and push your branch to GitHub.
4. To update versions in the `package.json` for all packages, use `npx lerna version --force-publish`. `npx` will use the version of `lerna` that is installed as a `devDependency` of the mono-repo. `--force-publish` will update interdependencies as well as the version numbers of the packages themselves.
5. Open a pull request with your updates
6. Merge the pull request after version-checking tests finish
7. Create a tag on GitHub for the version
8. Check out master and pull again. `git checkout master`, `git pull origin master`
9. `lerna publish from-git` will update all packages that don't yet have the new version published. You can safely re-run this command if publishing is interrupted.
10. Make sure all the packages made it up to npm

## Pitfalls to look out for

- Always make sure you are publishing from an up-to-date copy of `master`. You don't want to publish stale code!
- New packages may need some additional configuration before they can be published
- If you have problems, check the version of lerna you are using. There may be new features in the lerna docs that are more recent than our version. Always use `npx` and not a globally installed version of lerna, for consistency.
