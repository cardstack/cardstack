import { Expression, separatedByCommas } from "./util";
import { CardId } from "../card";
import { Primitive } from "json-typescript";
import CardstackError from "../error";

interface Sort {
  name: string;
  order: 'asc' | 'desc';
  expression: Expression;
  leafField: unknown;
}

const PRIMARY_KEY = Object.freeze(['realm', 'original-realm', 'local-id']);

export class Sorts {
  private _sorts: Sort[];

  constructor(private baseType: CardId, rawSorts: string | string[] | undefined){
    let sorts: Sort[];
    if (rawSorts) {
      if (Array.isArray(rawSorts)){
        sorts = rawSorts.map(name => this.parseSort(name));
      } else {
        sorts = [this.parseSort(rawSorts)];
      }
    } else {
      sorts = [];
    }

    PRIMARY_KEY.forEach(name => {
      if (!sorts.find(entry => entry.name === name)) {
        sorts.push(this.parseSort(name));
      }
    });
    this._sorts = sorts;
  }

  orderExpression(): Expression {
    return (['order by '] as Expression).concat(separatedByCommas(this._sorts.map(({ expression, order }) => [...expression, order])));
  }

  afterExpression(cursor: string): Expression {
    let cursorValues = this._parseCursor(cursor);
    return this._afterExpression(cursorValues, 0);
  }

  _afterExpression(cursorValues: Primitive[], index: number): Expression {
    if(index === this._sorts.length) {
      return ['false'];
    }
    let { expression, order, leafField } = this._sorts[index];
    let value = leafField.buildValueExpression(cursorValues[index]);
    let operator = order === 'asc' ? '>' : '<';

    return ['(', ...expression, operator, ...value, ') OR ((', ...expression, '=', ...value, ') AND (', ...this._afterExpression(cursorValues, index + 1), '))'];
  }

  _parseCursor(cursor: string): Primitive[] {
    let cursorValues;
    try {
      cursorValues = JSON.parse(decodeURIComponent(cursor));
      if (cursorValues.length !== this._sorts.length) {
        throw new CardstackError("Invalid cursor value", { status: 400 });
      }
    } catch (err) {
      throw new CardstackError("Invalid cursor value", { status: 400 });
    }
    return cursorValues;
  }

  getCursor(lastRow: any) {
    return encodeURIComponent(JSON.stringify(this._sorts.map((_unused, index)=> lastRow[`cursor${index}`])));
  }

  parseSort(name: string): Sort {
    let realName, order;
    if (name.indexOf('-') === 0) {
      realName = name.slice(1);
      order = 'desc';
    } else {
      realName = name;
      order = 'asc';
    }
    let { expression, leafField } = searcher.buildQueryExpression(schema, realName, 'sort');
    return {
      name: realName,
      order,
      expression,
      leafField
     };
  }

  cursorColumns() {
    return separatedByCommas(this._sorts.map(({ expression }, index)=> {
      return [...expression, `AS cursor${index}`];
    }));
  }
}
