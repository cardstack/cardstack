import { CardExpression, separatedByCommas, param, fieldQuery, FieldQuery, fieldValue } from './util';
import { CardId } from '@cardstack/core/card-id';
import { Primitive } from 'json-typescript';
import CardstackError from '@cardstack/core/error';

interface Sort {
  name: string;
  order: 'asc' | 'desc';
  fieldQuery: FieldQuery;
}

const PRIMARY_KEY = Object.freeze(['csRealm', 'csOriginalRealm', 'csId']);

export class Sorts {
  private _sorts: Sort[];

  constructor(private baseType: CardId, rawSorts: string | string[] | undefined) {
    let sorts: Sort[];
    if (rawSorts) {
      if (Array.isArray(rawSorts)) {
        sorts = rawSorts.map(name => this.parseSort(baseType, name));
      } else {
        sorts = [this.parseSort(baseType, rawSorts)];
      }
    } else {
      sorts = [];
    }

    for (let name of PRIMARY_KEY) {
      if (!sorts.find(entry => entry.name === name)) {
        sorts.push(this.parseSort(baseType, name));
      }
    }
    this._sorts = sorts;
  }

  private parseSort(baseType: CardId, name: string): Sort {
    let realName;
    let order: 'asc' | 'desc';
    if (name.indexOf('-') === 0) {
      realName = name.slice(1);
      order = 'desc';
    } else {
      realName = name;
      order = 'asc';
    }
    return {
      name: realName,
      order,
      fieldQuery: fieldQuery(baseType, realName, 'sort'),
    };
  }

  orderExpression(): CardExpression {
    return (['order by '] as CardExpression).concat(
      separatedByCommas(this._sorts.map(({ fieldQuery, order }) => [fieldQuery, order]))
    );
  }

  afterExpression(cursor: string): CardExpression {
    let cursorValues = this._parseCursor(cursor);
    return this._afterExpression(cursorValues, 0);
  }

  private _afterExpression(cursorValues: Primitive[], index: number): CardExpression {
    if (index === this._sorts.length) {
      return ['false'];
    }
    let { name, fieldQuery, order } = this._sorts[index];
    let value = fieldValue(this.baseType, name, [param(cursorValues[index])], 'sort');
    let operator = order === 'asc' ? '>' : '<';

    return [
      '(',
      fieldQuery,
      operator,
      value,
      ') OR ((',
      fieldQuery,
      '=',
      value,
      ') AND (',
      ...this._afterExpression(cursorValues, index + 1),
      '))',
    ];
  }

  private _parseCursor(cursor: string): Primitive[] {
    let cursorValues;
    try {
      cursorValues = JSON.parse(decodeURIComponent(cursor));
      if (cursorValues.length !== this._sorts.length) {
        throw new CardstackError('Invalid cursor value', { status: 400 });
      }
    } catch (err) {
      throw new CardstackError('Invalid cursor value', { status: 400 });
    }
    return cursorValues;
  }

  getCursor(lastRow: any) {
    return encodeURIComponent(JSON.stringify(this._sorts.map((_unused, index) => lastRow[`cursor${index}`])));
  }

  cursorColumns() {
    return separatedByCommas(
      this._sorts.map(({ fieldQuery }, index) => {
        return [fieldQuery, `AS cursor${index}`];
      })
    );
  }
}
