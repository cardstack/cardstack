import type Koa from "koa";
import { Project } from "scenario-tester";
import { createServer } from "../src/server";
import supertest from "supertest";
import QUnit from "qunit";

// TODO: share this in core
export function templateOnlyComponentTemplate(template: string): string {
  return `import { setComponentTemplate } from '@ember/component';
  import { precompileTemplate } from '@ember/template-compilation';
  import templateOnlyComponent from '@ember/component/template-only';
  export default setComponentTemplate(
    precompileTemplate('${template}', {
      strictMode: true,
    }),
    templateOnlyComponent()
  );`;
}

QUnit.module("Card Data", function (hooks) {
  let realm: Project;
  let server: Koa;

  hooks.beforeEach(async function () {
    realm = new Project("my-realm");

    realm.addDependency("post", {
      files: {
        "schema.js": `
      import { contains } from "@cardstack/types";
      import string from "https://cardstack.com/base/models/string";
      export default class Post {
        @contains(string)
        title;
        @contains(string)
        body;
      }`,
        "isolated.js": templateOnlyComponentTemplate(
          "<h1><@model.title/></h1><article><@model.body/></article>"
        ),
      },
    });

    realm.addDependency("post0", {
      files: {
        "schema.js": `
          import { adopts } from "@cardstack/types";
          import post from "https://my-realm/post";
          
          export default @adopts(post) class Post {}
        `,
        "data.json": JSON.stringify(
          {
            data: {
              attributes: {
                title: "Hello World",
                body: "First post.",
              },
            },
            meta: {
              // this is a URL. When relative, it's interpreted relative to this
              // card's URL.
              adoptsFrom: "../post",
            },
          },
          null,
          2
        ),
      },
    });

    realm.writeSync();

    server = await createServer({ "my-realm": realm.baseDir });
  });
  QUnit.test("404s when you try to load a card outside of it's realm", async function (assert) {
    let response = await supertest(server.callback()).get("/realms/other-realm/post0").expect(404);
    assert.ok(response);
  });

  QUnit.test("can load a simple isolated card's data", async function (assert) {
    let response = await supertest(server.callback()).get("/realms/my-realm/post0").expect(200);
    assert.equal(response.body, {
      data: {
        attributes: {
          title: "Hello World",
          body: "First post.",
        },
        meta: {
          isolatedComponentModule: "@cardstack/compiled/my-realm/post0/isolated",
        },
      },
    });
  });
});
