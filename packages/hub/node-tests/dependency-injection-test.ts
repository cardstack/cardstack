import { Registry, Container, inject, getOwner } from "../dependency-injection";

describe("hub/dependency-injection", function() {
  let registry: Registry;
  let container: Container;

  before(function() {
    registry = new Registry();
    registry.register("testExample", ExampleService);
    registry.register("testConsumer", ConsumingService);
    registry.register("test-has-async", HasAsyncReady);
    registry.register("testBadService", BadService);
    registry.register("testCircleOne", CircleOneService);
    registry.register("testCircleTwo", CircleTwoService);
  });

  beforeEach(function() {
    container = new Container(registry);
  });

  afterEach(async function() {
    await container.teardown();
  });

  it("it can inject a service", async function() {
    let consumer = await container.lookup("testConsumer");
    expect(consumer.useIt()).equals("Quint");
    expect(consumer.theAnswer()).equals("Quint");
  });

  it("errors if you mis-assign an injection", async function() {
    try {
      await container.lookup("testBadService");
      throw new Error("should not get here");
    } catch (err) {
      expect(err.message).to.match(/you must pass the 'as' argument/);
    }
  });

  it("returns the same singleton", async function() {
    let instance = await container.lookup("testConsumer");
    let second = await container.lookup("testConsumer");
    expect(instance).equals(second);
  });

  it("supports getOwner", async function() {
    let instance = await container.lookup("testConsumer");
    let owner = getOwner(instance);
    expect(owner).equals(container);
  });

  it("supports instantiating your own class", async function() {
    let thing = await container.instantiate(
      class {
        testExample = inject("testExample");
      }
    );
    expect(thing.testExample.whoAreYou()).to.equal("Quint");
  });

  it("supports instantiating your own class with an arg", async function() {
    class X {
      testExample = inject("testExample");
      constructor(public options: { quiet: boolean }) {}
    }
    let thing = await container.instantiate(X, { quiet: true });
    expect(thing.testExample.whoAreYou()).to.equal("Quint");
    expect(thing.options).to.deep.equal({ quiet: true });
  });

  it("container teardown call teardown on container.instantiated instance", async function() {
    let isTornDown = false;
    class X {
      async teardown() {
        isTornDown = true;
      }
    }
    await container.instantiate(X);
    await container.teardown();
    expect(isTornDown).to.equal(true);
  });

  it("container teardown call teardown on container.lookup instance", async function() {
    exampleServiceTornDown = false;

    await container.lookup("testExample");
    await container.teardown();
    expect(exampleServiceTornDown).to.equal(true);
  });

  it("throws when a circle would have deadlocked", async function() {
    try {
      await container.lookup("testCircleOne");
      throw new Error(`shouldn't get here`);
    } catch(err) {
      expect(err.message).to.match(/circular dependency injection: testCircleOne -> testCircleTwo -> testCircleOne/);
    }
  });
});

let exampleServiceTornDown = false;
class ExampleService {
  whoAreYou() {
    return "Quint";
  }
  async teardown() {
    exampleServiceTornDown = true;
  }
}

class HasAsyncReady {
  testExample = inject("testExample");

  answer: string | undefined;

  async ready() {
    this.answer = this.testExample.whoAreYou();
  }
}

class ConsumingService {
  testExample = inject("testExample");
  hasAsync = inject("test-has-async", { as: "hasAsync" });

  useIt() {
    return this.testExample.whoAreYou();
  }

  theAnswer() {
    return this.hasAsync.answer;
  }
}

class BadService {
  weird = inject("testExample");
}

class CircleOneService {
  testCircleTwo = inject("testCircleTwo");
}

class CircleTwoService {
  testCircleOne = inject("testCircleOne");
}

declare module "@cardstack/hub/dependency-injection" {
  interface KnownServices {
    testExample: ExampleService;
    testConsumer: ConsumingService;
    "test-has-async": HasAsyncReady;
    testBadService: BadService;
    testCircleOne: CircleOneService;
    testCircleTwo: CircleTwoService;
  }
}
