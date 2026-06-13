const { Client } = require('pg');

const client = new Client({
  host: 'db.ayklmrpdaxqtjheomnon.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'Qara11_lafatma',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log('Running ALTER TABLE check_in...');
  await client.query('ALTER TABLE check_in ADD COLUMN archived BOOLEAN NOT NULL DEFAULT false;');
  console.log('ALTER TABLE complete!');
  const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'check_in';");
  console.log(res.rows);
  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
