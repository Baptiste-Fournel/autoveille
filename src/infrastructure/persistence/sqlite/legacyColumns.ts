import type Database from 'better-sqlite3';

interface LegacyColumn {
  readonly table: string;
  readonly column: string;
  readonly addition: string;
}

const COLUMNS_ADDED_AFTER_THE_FIRST_VERSION: readonly LegacyColumn[] = [
  { table: 'listings', column: 'description', addition: 'ALTER TABLE listings ADD COLUMN description TEXT' },
  { table: 'vehicles', column: 'note', addition: 'ALTER TABLE vehicles ADD COLUMN note TEXT' },
  { table: 'vehicles', column: 'published_at', addition: 'ALTER TABLE vehicles ADD COLUMN published_at TEXT' },
];

const hasColumn = (database: Database.Database, { table, column }: LegacyColumn): boolean =>
  database
    .prepare<[string, string], { readonly found: number }>('SELECT 1 AS found FROM pragma_table_info(?) WHERE name = ?')
    .get(table, column) !== undefined;

export function addMissingLegacyColumns(database: Database.Database): void {
  COLUMNS_ADDED_AFTER_THE_FIRST_VERSION.filter((legacyColumn) => !hasColumn(database, legacyColumn)).forEach(({ addition }) => {
    database.exec(addition);
  });
}
