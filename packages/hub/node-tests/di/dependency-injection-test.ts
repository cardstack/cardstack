import {
  Registry,
  Container,
  inject,
  getOwner,
  injectionReady,
  TypedKnownServices,
  InjectOptions,
} from '@cardstack/di';

describe('hub/di/dependency-injection', function () {
  let registry: Registry;
  let container: Container;

  before(function () {
    registry = new Registry();
    registry.register('testExample', ExampleService);
    registry.register('testConsumer', ConsumingService);
    registry.register('test-has-async', HasAsyncReady);
    registry.register('testBadService', BadService);
    registry.register('testCircleOne', CircleOneService);
    registry.register('testCircleTwo', CircleTwoService);
    registry.register('testCircleThree', CircleThreeService);
    registry.register('testCircleFour', CircleFourService);
    registry.register('testCircleFive', new CircleFiveServiceFactory());
    registry.register('testSpecificType', UsesSpecificType, { type: 'test-things' });
    registry.register('injectsSpecificType', InjectsSpecificType, { type: 'test-things' });
    registry.register('usesCustomInjector', UsesCustomInjector, { type: 'test-things' });
    registry.registerType('test-things', async (name: string) => {
      return (await import(`./test-things/${name}`)).default;
    });
  });

  beforeEach(function () {
    container = new Container(registry);
  });

  afterEach(async function () {
    await container.teardown();
  });

  it('can inject a service', async function () {
    let consumer = await container.lookup('testConsumer');
    expect(consumer.useIt()).equals('Quint');
    expect(consumer.theAnswer()).equals('Quint');
  });

  it('errors if you mis-assign an injection', async function () {
    try {
      await container.lookup('testBadService');
      throw new Error('should not get here');
    } catch (err) {
      expect(err.message).to.match(/you must pass the 'as' argument/);
    }
  });

  it('returns the same singleton', async function () {
    let instance = await container.lookup('testConsumer');
    let second = await container.lookup('testConsumer');
    expect(instance).equals(second);
  });

  it('supports getOwner', async function () {
    let instance = await container.lookup('testConsumer');
    let owner = getOwner(instance);
    expect(owner).equals(container);
  });

  it('supports instantiating your own class', async function () {
    let thing = await container.instantiate(
      class {
        testExample = inject('testExample');
      }
    );
    expect(thing.testExample.whoAreYou()).to.equal('Quint');
  });

  it('supports instantiating your own class with an arg', async function () {
    class X {
      testExample = inject('testExample');
      constructor(public options: { quiet: boolean }) {}
    }
    let thing = await container.instantiate(X, { quiet: true });
    expect(thing.testExample.whoAreYou()).to.equal('Quint');
    expect(thing.options).to.deep.equal({ quiet: true });
  });

  it('container teardown call teardown on container.lookup instance', async function () {
    exampleServiceTornDown = false;

    await container.lookup('testExample');
    await container.teardown();
    expect(exampleServiceTornDown).to.equal(true);
  });

  it('allows circular injection when not accessing eachother within ready()', async function () {
    let one = await container.lookup('testCircleOne');
    expect(one.testCircleTwo?.iAmTwo).equals(true);
    expect(one.testCircleTwo?.testCircleOne).equals(one);
  });

  it('throws when a circle would have deadlocked', async function () {
    try {
      await container.lookup('testCircleThree');
      throw new Error(`shouldn't get here`);
    } catch (err) {
      expect(err.message).to.match(
        /circular dependency: testCircleThree tries to eagerly inject testCircleFour, which depends on testCircleThree/
      );
    }
  });

  it('supports method factory as an alternative to constructor factories', async function () {
    let five = await container.lookup('testCircleFive');
    expect(five.iAmFive).equals(true);
    expect(five.testCircleTwo?.iAmTwo).equals(true);
  });

  it('can lookup something that was registered explicitly under a non-default type', async function () {
    let example = await container.lookup('testSpecificType', { type: 'test-things' });
    expect(example.isUseANonDefaultType).equals(true);
  });

  it('can inject something that was registered explicitly under a non-default type', async function () {
    let example = await container.lookup('injectsSpecificType', { type: 'test-things' });
    expect(example.u.isUseANonDefaultType).equals(true);
  });

  it('can make a custom type-specific injector', async function () {
    let example = await container.lookup('usesCustomInjector', { type: 'test-things' });
    expect(example.viaCustomInjector.isUseANonDefaultType).equals(true);
  });

  it('can discover modules registered via type patterns', async function () {
    let example = await container.lookup('discovered', { type: 'test-things' });
    expect(example.iWasDiscovered).equals(true);
  });
});

let exampleServiceTornDown = false;
class ExampleService {
  whoAreYou() {
    return 'Quint';
  }
  async teardown() {
    exampleServiceTornDown = true;
  }
}

class HasAsyncReady {
  testExample = inject('testExample');

  answer: string | undefined;

  async ready() {
    await injectionReady(this, 'testExample');
    this.answer = this.testExample.whoAreYou();
  }
}

class ConsumingService {
  testExample = inject('testExample');
  hasAsync = inject('test-has-async', { as: 'hasAsync' });

  useIt() {
    return this.testExample.whoAreYou();
  }

  theAnswer() {
    return this.hasAsync.answer;
  }
}

class BadService {
  weird = inject('testExample');
}

class CircleOneService {
  testCircleTwo = inject('testCircleTwo');
  iAmOne = true;
}

class CircleTwoService {
  testCircleOne = inject('testCircleOne');
  iAmTwo = true;
}

class CircleThreeService {
  testCircleFour = inject('testCircleFour');
  iAmThree = true;
  async ready() {
    await injectionReady(this, 'testCircleFour');
  }
}

class CircleFourService {
  testCircleThree = inject('testCircleThree');
  iAmFour = true;
}

class CircleFiveService {
  testCircleTwo = inject('testCircleTwo');
  iAmFive = true;
}
class CircleFiveServiceFactory {
  create() {
    return new CircleFiveService();
  }
}

class UsesSpecificType {
  isUseANonDefaultType = true;
}

class InjectsSpecificType {
  u = inject('testSpecificType', { type: 'test-things', as: 'u' });
}

class UsesCustomInjector {
  viaCustomInjector = testThing('testSpecificType', { as: 'viaCustomInjector' });
}

function testThing<Name extends keyof TypedKnownServices['test-things']>(
  name: Name,
  opts?: Omit<InjectOptions, 'type'>
): TypedKnownServices['test-things'][Name] {
  return inject(name, { type: 'test-things', ...opts });
}

export interface KnownTestThings {
  testSpecificType: UsesSpecificType;
  injectsSpecificType: InjectsSpecificType;
  usesCustomInjector: UsesCustomInjector;
  foundViaPattern: { yesIWasFound: true };
}

declare module '@cardstack/di' {
  interface KnownServices {
    testExample: ExampleService;
    testConsumer: ConsumingService;
    'test-has-async': HasAsyncReady;
    testBadService: BadService;
    testCircleOne: CircleOneService;
    testCircleTwo: CircleTwoService;
    testCircleThree: CircleThreeService;
    testCircleFour: CircleFourService;
    testCircleFive: CircleFiveService;
  }
  interface TypedKnownServices {
    'test-things': KnownTestThings;
  }
}
