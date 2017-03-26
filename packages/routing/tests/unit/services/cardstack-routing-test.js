import { moduleFor, test } from 'ember-qunit';

moduleFor('service:cardstack-routing', 'Unit | Service | cardstack routing', {
  // Specify the other units that are required for this test.
  // needs: ['service:foo']
  beforeEach() {
    this.register('config:environment', {
      cardstack: {
        defaultBranch: 'my-live-branch',
        defaultContentType: 'sandwiches'
      }
    });
  }
});

test('provides defaultBranch', function(assert) {
  let service = this.subject();
  assert.equal(service.get('defaultBranch'), 'my-live-branch');
});

test('it routes to normal content, default branch', function(assert) {
  let service = this.subject();
  assert.deepEqual(
    service.routeFor('posts', 'the-best', 'my-live-branch'),
    {
      name: 'cardstack.content',
      args: ['posts', 'the-best'],
      queryParams: { branch: undefined }
    }
  );
});

test('it routes to normal content, other branch', function(assert) {
  let service = this.subject();
  assert.deepEqual(
    service.routeFor('posts', 'the-best', 'some-branch'),
    {
      name: 'cardstack.content',
      args: ['posts', 'the-best'],
      queryParams: { branch: 'some-branch' }
    }
  );
});

test('it routes to default content', function(assert) {
  let service = this.subject();
  assert.deepEqual(
    service.routeFor('sandwiches', 'the-best', 'some-branch'),
    {
      name: 'cardstack.default-content',
      args: ['the-best'],
      queryParams: { branch: 'some-branch' }
    }
  );
});
