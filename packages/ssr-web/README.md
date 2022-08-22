# ssr-web

This renders Card Pay payment requests on the server.

## Prerequisites

You will need the following things properly installed on your computer.

* [Git](https://git-scm.com/)
* [Node.js](https://nodejs.org/)
* [Yarn](https://yarnpkg.com/)
* [Ember CLI](https://cli.emberjs.com/release/)
* [Google Chrome](https://google.com/chrome/)

## Installation

* `git clone <repository-url>` this repository
* `cd packages/ssr-web`
* `yarn install`

## Running / Development

* `ember serve`
* Visit your app at [http://localhost:4210](http://localhost:4210).
* Visit your tests at [http://localhost:4210/tests](http://localhost:4210/tests).

Note that you will have to run the hub for exchange rates if you want to enforce the minimum transaction amount in local development, see [the hub README](../hub/README.md#running).

### Required environment variables

Deployed versions will use a "HUB_URL" env var.

### Viewing the app locally
This app is actually two apps in one: 
1. Wallet (Universal Link): An app that hosts a page for folks to request payments from others (wallet.cardstack.com), and acts as a fallback for the universal link.
2. card.xyz: An app to view profiles on the web.

The fastboot server differentiates which app is being served via host. We follow this behaviour in local development, matching the `.card.xyz.localhost:4210` suffix to recognize a request's intention to visit card.xyz. When developing locally, you can view a user's card.xyz at `${paymentProfileId}.card.xyz.localhost:4210`.  Requests that do not match this pattern will be treated as intending to visit the wallet domain.

**IMPORTANT: This does not work on Safari, only Firefox and Chrome. Instructions for Safari setup below.**

If you want to develop card.xyz on Safari with the behaviour described above, you should:
1. Add `card.xyz.localhost` to your `/etc/hosts` as an alias of `127.0.0.1`
2. Install `dnsmasq` with Homebrew. Wildcard DNS support does not come by default, so the entry in step 1 will only match `card.xyz.localhost`, not `${spaceId}.card.xyz.localhost`. `dnsmasq` fixes this.
3. Make a directory for `dnsmasq` config to live: `sudo mkdir -p $(brew --prefix)/etc/dnsmasq.d`
4. Make sure that the `dnsmasq` config points to your new directory:
```
# Get absolute path to homebrew prefix
brew --prefix # assume returns /opt/homebrew/
# Use it to point dnsmasq to your config
sudo echo 'conf-dir=/opt/homebrew/etc/dnsmasq.d,*.conf' >> $(brew --prefix)/etc/dnsmasq.conf
```
5. Configure `card.xyz.localhost` for `dnsmasq`: 
```
sudo echo 'address=/.card.xyz.localhost/127.0.0.1' > $(brew --
prefix)/etc/dnsmasq.d/card.xyz.localhost.conf
```
6. Add a resolver for `card.xyz.localhost`:
```
sudo mkdir -p /etc/resolver
sudo touch /etc/resolver/card.xyz.localhost
sudo bash -c 'echo "nameserver 127.0.0.1" > /etc/resolver/card.xyz.localhost'
```
7. You may need to restart `dnsmasq` to make sure it gets the new changes:
```
sudo launchctl stop homebrew.mxcl.dnsmasq
sudo launchctl start homebrew.mxcl.dnsmasq
```
8. Confirm via `scutil --dns` that there is a resolver for `card.xyz.localhost`. It should look similar to:
```
resolver #8
  domain   : card.xyz.localhost
  nameserver[0] : 127.0.0.1
  flags    : Request A records, Request AAAA records
  reach    : 0x00030002 (Reachable,Local Address,Directly Reachable Address)
```

You may need to specifically type the full url in Safari: `http://someone.card.xyz.localhost:4210`.

### Viewing the locally served app on a mobile device

To connect a wallet using WalletConnect on a mobile device, a https connection is needed, otherwise connecting a wallet will fail.

To get around that, we recommend setting up a tunnel, for
example a [Cloudflare tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/tunnel-guide/) which exposes your locally served app via a secure tunnel. If you need to view the locally served app on your mobile often, it makes sense to use long-lived urls, which you can configure using your own subdomains which you set up within your DNS provider.

Your `config.yml` should look like this (replace the hostnames with your own):

```yml
tunnel: <Tunnel-UUID>
credentials-file: .cloudflared/<Tunnel-UUID>.json // depends on your cloudflared installation path

ingress:
  - hostname: cardstack-hub-develop.your-domain.com
    service: http://localhost:3000
  - hostname: cardstack-ssr-web-develop.your-domain.com
    service: http://localhost:4210
  - hostname: cardstack-web-client-develop.your-domain.com # If you work on web-client too
    service: http://localhost:4200
  - service: http_status:404
```

Follow the [instructions](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/tunnel-guide/) on how to create CNAME records for your development
subdomains, and run the tunnel. After your tunnel is running, run the app with the following command (make sure to change the value of `HUB_URL`):

`HUB_URL="https://cardstack-hub-develop.your-domain.com" ember s`

Then, you can access your locally served app on your mobile device using `https://cardstack-ssr-web-develop.your-domain.com`.

### Running Tests

* `ember test`
* `ember test --server`

### Linting

* `yarn lint`
* `yarn lint:fix`

### Building

* `ember build` (development)
* `ember build --environment production` (production)

### Deploying

TBD

## Further Reading / Useful Links

* [ember.js](https://emberjs.com/)
* [ember-cli](https://cli.emberjs.com/release/)
* Development Browser Extensions
  * [ember inspector for chrome](https://chrome.google.com/webstore/detail/ember-inspector/bmdblncegkenkacieihfhpjfppoconhi)
  * [ember inspector for firefox](https://addons.mozilla.org/en-US/firefox/addon/ember-inspector/)
