<iframe src="https://xd.adobe.com/embed/fc8c4920-5374-4476-5ec6-ba629f92f862-8abd/screen/69e7b00f-4d1d-4dc7-a88d-bb4fb23e4bd6/Zoom-in-Plane-1-" frameborder="0" allowfullscreen></iframe>

boxel
==============================================================================


Generating multiple image sizes / thumbs from
`/public/media-registry/covers/`:

Kill your ember server if it's running otherwise it'll try to rebuild for every
size generated.

```sh

brew install imagemagick # if not installed already
cd boxel
node generate-thumbs.js
```

The thumbs / sizes are intended to be committed to the repo for simplicity of
static deployment

Using imgix for dynamic production data makes sense when there is a backend
server to sign image urls, but for static deployment pregenerating the images is
way more convenient than pre-signing the images as the necessary hooks do not
exist in broccoli-asset-rev
