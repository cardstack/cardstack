import { WriterFactory } from './writer';
import { IndexerFactory } from './indexing';
import * as FieldHooks from './field-hooks';
import { FieldCard, Card, RawData } from './card';

export interface Features {
  writer: WriterFactory;
  indexer: IndexerFactory;
  'field-validate': FieldHooks.validate<unknown>;
  'field-deserialize': FieldHooks.deserialize<unknown, unknown>;
  'field-buildValueExpression': FieldHooks.buildValueExpression;
  'field-buildQueryExpression': FieldHooks.buildQueryExpression;
  'isolated-layout': string;
  'embedded-layout': string;
  'field-view-layout': string;
  'field-edit-layout': string;
  'isolated-css': string;
  'embedded-css': string;
  compute: (context: { field: FieldCard; card: Card }) => RawData;
}
