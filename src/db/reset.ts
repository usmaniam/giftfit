import postgres from 'postgres';

// Local development only: drops every table. Refuses to run against a remote database.
const url = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/giftfit';
if (!/@(localhost|127\.0\.0\.1|db)(:|\/)/.test(url)) {
  console.error('db:reset only runs against a local database. Refusing.');
  process.exit(1);
}
const sql = postgres(url, { onnotice: () => {} });
await sql.unsafe('drop schema public cascade; create schema public;');
await sql.end();
console.log('Local database reset.');
