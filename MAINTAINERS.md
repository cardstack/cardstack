# Maintainers

This document is for project maintainers who are doing versioning, releases, and publishing for the cardstack mono-repo.

## Updating package versions (with safeguards)

The versions of all packages in the mono-repo are updated at the same time, to the same version number.

1. Get the latest code on master: `git checkout master`, `git pull origin master`
2. Make sure your history is clean with `git status`
3. Look at the `git log` since the last release, and list anything significant in the `CHANGELOG.md`.
Determine whether the release should be a major (breaking), minor, or patch.
For breaking releases, include upgrade instructions in the changelog. Commit your changes.
4. Update all package versions, publish to npm, and push to GitHub with this command: `npx lerna publish --force-publish="*" --exact`
7. Check to see that the new version is on GitHub and on npm

## Updating packages yolo-style

If you are very confident in what you are doing, you can accomplish all of the above by running this command from an up-to-date version of `master`.

```sh
npx lerna publish --force-publish="*" --exact
```

## Pitfalls to look out for

- Always make sure you are publishing from an up-to-date copy of `master`. You don't want to publish stale code!
- New packages may need some additional configuration before they can be published
- If you have problems, check the version of lerna you are using. There may be new features in the lerna docs that are more recent than our version. Always use `npx` and not a globally installed version of lerna, for consistency.
