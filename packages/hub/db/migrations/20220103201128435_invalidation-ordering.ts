import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createType('card_dep', { url: 'text', deps: 'text[]' });
  pgm.createFunction(
    'deps_cmp',
    ['card_dep', 'card_dep'],
    { returns: 'integer', language: 'sql' },
    `
    select case
      when $1.url = any($2.deps)
        then 1
      when $2.url = any($1.deps)
        then -1
      else
        case
          when $1.url < $2.url
            then -1
          when $2.url < $1.url
            then 1
          else
            0
          end
      end
    ;
  `
  );
  pgm.createFunction(
    'card_lt',
    ['card_dep', 'card_dep'],
    { returns: 'bool', language: 'sql' },
    `select deps_cmp($1, $2) < 0;`
  );
  pgm.createFunction(
    'card_gt',
    ['card_dep', 'card_dep'],
    { returns: 'bool', language: 'sql' },
    `select deps_cmp($1, $2) > 0;`
  );
  pgm.createFunction(
    'card_eq',
    ['card_dep', 'card_dep'],
    { returns: 'bool', language: 'sql' },
    `select deps_cmp($1, $2) = 0;`
  );
  pgm.createOperatorFamily('card_fam', 'btree');
  pgm.createOperator('<^', { left: 'card_dep', right: 'card_dep', procedure: 'card_lt' });
  pgm.createOperator('>^', { left: 'card_dep', right: 'card_dep', procedure: 'card_gt' });
  pgm.createOperator('?-', { left: 'card_dep', right: 'card_dep', procedure: 'card_eq' });
  pgm.sql(`
  create operator class card_ops for type card_dep using btree family card_fam as
    operator 1 <^,
    operator 3 ?-,
    operator 5 >^,
    function 1 deps_cmp(card_dep, card_dep);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropOperatorClass('card_ops', 'btree', { ifExists: true, cascade: true });
  pgm.dropOperator('<^', { left: 'card_dep', right: 'card_dep', ifExists: true, cascade: true });
  pgm.dropOperator('>^', { left: 'card_dep', right: 'card_dep', ifExists: true, cascade: true });
  pgm.dropOperator('?-', { left: 'card_dep', right: 'card_dep', ifExists: true, cascade: true });
  pgm.dropOperatorFamily('card_fam', 'btree', { ifExists: true, cascade: true });
  pgm.dropFunction('card_lt', ['card_dep', 'card_dep'], { ifExists: true, cascade: true });
  pgm.dropFunction('card_gt', ['card_dep', 'card_dep'], { ifExists: true, cascade: true });
  pgm.dropFunction('card_eq', ['card_dep', 'card_dep'], { ifExists: true, cascade: true });
  pgm.dropFunction('deps_cmp', ['card_dep', 'card_dep'], { ifExists: true, cascade: true });
  pgm.dropType('card_dep', { ifExists: true, cascade: true });
}
