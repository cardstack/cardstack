import QUnit from "qunit";
import { Project } from "scenario-tester";
import { createServer } from "../src/server.js";
import supertest from "supertest";

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

QUnit.module("Card Data", function () {
  QUnit.test("can load a simple isolated card's data", async function (assert) {
    let realm = new Project("my-realm");

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

    let server = await createServer({ "my-realm": realm.baseDir });
    let response = await supertest(server.callback())
      .get("/realms/my-realm/post0")
      .expect(200);
    assert.equal(response.body, {
      data: {
        attributes: {
          title: "Hello World",
          body: "First post.",
        },
        meta: {
          componentModule: "@cardstack/compiled/???",
        },
      },
    });
  });
});
