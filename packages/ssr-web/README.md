# ssr-web

This renders Card Pay merchant payment requests on the server.

## Prerequisites

You will need the following things properly installed on your computer.

* [Git](https://git-scm.com/)
* [Node.js](https://nodejs.org/)
* [Yarn](https://yarnpkg.com/)
* [Ember CLI](https://ember-cli.com/)
* [Google Chrome](https://google.com/chrome/)

## Installation

* `git clone <repository-url>` this repository
* `cd packages/ssr-web`
* `yarn install`

## Running / Development

* `ember serve -prod` (must be production [for now](https://github.com/embroider-build/embroider/issues/1049#issuecomment-1034079882))
* Visit your app at [http://localhost:4210](http://localhost:4210).
* Visit your tests at [http://localhost:4210/tests](http://localhost:4210/tests).

Note that you will have to run the hub for exchange rates if you want to enforce the minimum transaction amount in local development, see [the hub README](../hub/README.md#running).

### Required environment variables

Deployed versions will use a "HUB_URL" env var.

### Viewing the app locally
This app is actually two apps in one: 
1. Wallet (Universal Link): An app that hosts a page for folks to request payments from others (wallet.cardstack.com), and acts as a fallback for the universal link.
2. Card Space: An app to view profiles of businesses.

The fastboot server differentiates which app is being served via host. We follow this behaviour in local development, matching the `.card.space.localhost:4210` suffix to recognize a request's intention to visit card space. When developing locally, you can view a user's Card Space at `${businessId}.card.space.localhost:4210`. 

**IMPORTANT: This does not work on Safari, only Firefox and Chrome. Instructions for Safari setup below.**

If you want to develop Card Space on Safari with the behaviour described above, you should:
1. Add `card.space.localhost` to your `/etc/hosts` as an alias of `127.0.0.1`
2. Install `dnsmasq` with Homebrew. Wildcard DNS support does not come by default, so the entry in step 1 will only match `card.space.localhost`, not `${spaceId}.card.space.localhost`. `dnsmasq` fixes this.
3. Make a directory for `dnsmasq` config to live: `sudo mkdir -p $(brew --prefix)/etc/dnsmasq.d`
4. Make sure that the `dnsmasq` config points to your new directory:
```
# Get absolute path to homebrew prefix
brew --prefix # assume returns /opt/homebrew/
# Use it to point dnsmasq to your config
sudo echo 'conf-dir=/opt/homebrew/etc/dnsmasq.d,*.conf' >> $(brew --prefix)/etc/dnsmasq.conf
```
5. Configure `card.space.localhost` for `dnsmasq`: 
```
sudo echo 'address=/.card.space.localhost/127.0.0.1' > $(brew --
prefix)/etc/dnsmasq.d/card.space.localhost.conf
```
6. Add a resolver for `card.space.localhost`:
```
sudo mkdir -p /etc/resolver
sudo touch /etc/resolver/card.space.localhost
sudo bash -c 'echo "nameserver 127.0.0.1" > /etc/resolver/card.space.localhost'
```
7. You may need to restart `dnsmasq` to make sure it gets the new changes:
```
sudo launchctl stop homebrew.mxcl.dnsmasq
sudo launchctl start homebrew.mxcl.dnsmasq
```
8. Confirm via `scutil --dns` that there is a resolver for `card.space.localhost`. It should look similar to:
```
resolver #8
  domain   : card.space.localhost
  nameserver[0] : 127.0.0.1
  flags    : Request A records, Request AAAA records
  reach    : 0x00030002 (Reachable,Local Address,Directly Reachable Address)
```

You may need to specifically type the full url in Safari: `http://someone.card.space.localhost:4210`.

### Running Tests

* `ember test`
* `ember test --server`

### Linting

* `yarn lint:hbs`
* `yarn lint:js`
* `yarn lint:js --fix`

### Building

* `ember build` (development)
* `ember build --environment production` (production)

### Deploying

TBD

## Further Reading / Useful Links

* [ember.js](https://emberjs.com/)
* [ember-cli](https://ember-cli.com/)
* Development Browser Extensions
  * [ember inspector for chrome](https://chrome.google.com/webstore/detail/ember-inspector/bmdblncegkenkacieihfhpjfppoconhi)
  * [ember inspector for firefox](https://addons.mozilla.org/en-US/firefox/addon/ember-inspector/)
