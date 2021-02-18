<iframe src="https://xd.adobe.com/embed/fc8c4920-5374-4476-5ec6-ba629f92f862-8abd/screen/69e7b00f-4d1d-4dc7-a88d-bb4fb23e4bd6/Zoom-in-Plane-1-" frameborder="0" allowfullscreen></iframe>

# boxel

The repository provides an Ember Addon allowing usage of the Ember component library for the Boxel Design System.

It consists of several parts:
1. The Boxel Design System Components and their documentation
2. Various prototypes using the design system
3. Miscellaneous components that will eventually be moved

## Design system components
All components in `/addon/components` will be used in whatever apps consume the design system. Each component folder consists of several parts:
- `index.hbs` & `index.js`: The template and javascript for the component
    - *Note:* Unlike a usual Ember addon, these files are automatically reexported in whatever app consumes the addon. So there is no need to handle that on your own.
- `index.css`: The pure CSS styles associated with the component. This file will automatically be added to the consuming app as well
- `usage.hbs` & `usage.js`: A standardized way to document and experiment with the designs of each component. All usage files will automatically show up in the components list in `/docs` in the dummy app. Utilizes chrislopresto/ember-freestyle
    - *Note:* These files are automatically stripped out of any production build

## Prototypes
The prototypes are there to exercise in context various aspects of the design system. 

## Miscellaneous Components
There are many components that are specific to a certain prototype or will eventually be moved to other repos, like the main Cardhost app. 
## Running the dummy app

```sh
ember serve
```

Then browse to http://localhost:4200/
## Running tests

```sh
ember test
```

#### Thumbnails

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
