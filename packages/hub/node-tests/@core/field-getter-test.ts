import FieldGetter from '@cardstack/core/src/field-getter';
import get from 'lodash/get';

class Bio {
  #getRawField;

  constructor(get: (field: string) => any) {
    this.#getRawField = get;
  }

  async short() {
    return new FieldGetter(this.#getRawField, 'short');
  }
}

class Person {
  #getRawField: (field: string) => any;

  constructor(get: (field: string) => any) {
    this.#getRawField = get;
  }

  async firstName() {
    return new FieldGetter(this.#getRawField, 'firstName');
  }

  async lastName() {
    return new FieldGetter(this.#getRawField, 'lastName');
  }

  get aboutMe() {
    return new Bio((innerField: string) => this.#getRawField('aboutMe.' + innerField));
  }

  async fullName() {
    return 'Mr or Mrs ' + (await this.lastName());
  }
}

describe('FieldGetter', function () {
  it('can compile schema class constructor for composite card', async function () {
    let data = {
      firstName: 'Bob',
      lastName: 'Barker',
      aboutMe: { short: 'Is the host with the most' },
    };

    let person = new Person((fieldPath: string) => get(data, fieldPath));
    expect(await person.fullName()).to.equal('Mr or Mrs Barker');
    expect(await person.aboutMe.short()).to.equal(data.aboutMe.short);
  });
});
