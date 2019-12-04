import { Expression, separatedByCommas, param } from "./util";
import { CardId } from "../card";
import { Primitive } from "json-typescript";
import CardstackError from "../error";
import PgClient from "./pgclient";
import { Session } from "../session";

interface Sort {
  name: string;
  order: 'asc' | 'desc';
  expression: Expression;
  buildValueExpression: (e: Expression) => Expression;
}

const PRIMARY_KEY = Object.freeze(['realm', 'original-realm', 'local-id']);

export class Sorts {
  static async create(session: Session, pgclient: PgClient, baseType: CardId, rawSorts: string | string[] | undefined) {
    let sorts: Sort[];
    if (rawSorts) {
      if (Array.isArray(rawSorts)){
        sorts = await Promise.all(rawSorts.map(name => this.parseSort(pgclient, session, baseType, name)));
      } else {
        sorts = [await this.parseSort(pgclient, session, baseType, rawSorts)];
      }
    } else {
      sorts = [];
    }

    for (let name of PRIMARY_KEY) {
      if (!sorts.find(entry => entry.name === name)) {
        sorts.push(await this.parseSort(pgclient, session, baseType, name));
      }
    }
    return new this(sorts);
  }

  private static async parseSort(pgclient: PgClient, session: Session, baseType: CardId, name: string): Promise<Sort> {
    let realName;
    let order: "asc" | "desc";
    if (name.indexOf('-') === 0) {
      realName = name.slice(1);
      order = 'desc';
    } else {
      realName = name;
      order = 'asc';
    }
    let { expression, leafField } = await pgclient.buildQueryExpression(session, baseType, realName, 'sort');
    let buildValueExpression = await leafField.loadFeature('buildValueExpression');
    return {
      name: realName,
      order,
      expression,
      buildValueExpression,
    };
  }

  constructor(private _sorts: Sort[]) {}

  orderExpression(): Expression {
    return (['order by '] as Expression).concat(separatedByCommas(this._sorts.map(({ expression, order }) => [...expression, order])));
  }

  afterExpression(cursor: string): Expression {
    let cursorValues = this._parseCursor(cursor);
    return this._afterExpression(cursorValues, 0);
  }

  private _afterExpression(cursorValues: Primitive[], index: number): Expression {
    if(index === this._sorts.length) {
      return ['false'];
    }
    let { expression, order, buildValueExpression } = this._sorts[index];
    let value = buildValueExpression([param(cursorValues[index])]);
    let operator = order === 'asc' ? '>' : '<';

    return ['(', ...expression, operator, ...value, ') OR ((', ...expression, '=', ...value, ') AND (', ...this._afterExpression(cursorValues, index + 1), '))'];
  }

  private _parseCursor(cursor: string): Primitive[] {
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


  cursorColumns() {
    return separatedByCommas(this._sorts.map(({ expression }, index)=> {
      return [...expression, `AS cursor${index}`];
    }));
  }
}
