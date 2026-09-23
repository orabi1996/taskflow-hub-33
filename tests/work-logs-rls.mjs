// Run with NODE_PATH pointing to a directory containing @electric-sql/pglite,
// or install that package in a temporary test prefix and set PGLITE_MODULE.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const { PGlite } = await import(process.env.PGLITE_MODULE || "@electric-sql/pglite");
const db = new PGlite();
const ids = {
  employee: "00000000-0000-0000-0000-000000000001",
  manager: "00000000-0000-0000-0000-000000000002",
  other: "00000000-0000-0000-0000-000000000003",
  admin: "00000000-0000-0000-0000-000000000004",
};
await db.exec(`
 create role anon; create role authenticated;
 create schema auth;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
 grant usage on schema auth to authenticated;
 create table profiles(id uuid primary key, manager_id uuid, is_active boolean default true);
 create table user_roles(user_id uuid, role text);
 create function has_role(u uuid, r text) returns boolean language sql stable security definer as $$ select exists(select 1 from user_roles where user_id=u and role=r) $$;
 create function is_admin_or_gm(u uuid) returns boolean language sql stable security definer as $$ select has_role(u,'admin') or has_role(u,'general_manager') $$;
 create table clients(id uuid primary key);
 create table company_modules(id uuid primary key, is_active boolean default true);
 create table tasks(id uuid primary key, client_id uuid, module_id uuid);
 grant select on profiles, clients, company_modules, tasks to authenticated;
 insert into profiles(id,manager_id) values ('${ids.employee}','${ids.manager}'),('${ids.manager}',null),('${ids.other}',null),('${ids.admin}',null);
 insert into user_roles values ('${ids.manager}','manager'),('${ids.other}','manager'),('${ids.admin}','admin');
`);
await db.exec(
  readFileSync(
    new URL("../supabase/migrations/20260923220000_daily_work_logs.sql", import.meta.url),
    "utf8",
  ),
);
async function as(user, sql) {
  await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub = '${ids[user]}';`);
  return db.query(sql);
}
const row = (
  await as(
    "employee",
    `insert into work_logs(user_id,work_date,activity_type,description,outcome) values ('${ids.employee}','2026-09-01','work','Completed import','Validated import') returning id`,
  )
).rows[0].id;
assert.equal((await as("other", "select * from work_logs")).rows.length, 0);
assert.equal((await as("manager", "select * from work_logs")).rows.length, 1);
await assert.rejects(as("employee", `update work_logs set status='accepted' where id='${row}'`));
await assert.rejects(
  as(
    "employee",
    `insert into work_logs(user_id,work_date,activity_type,description,outcome) values ('${ids.other}','2026-09-01','work','Wrong owner','Wrong owner')`,
  ),
);
await assert.rejects(
  as(
    "employee",
    `update work_logs set task_id='00000000-0000-0000-0000-000000000099' where id='${row}'`,
  ),
);
await as("employee", `update work_logs set status='submitted' where id='${row}'`);
assert.equal(
  (
    await as(
      "employee",
      `update work_logs set description='Changed after sending' where id='${row}' returning id`,
    )
  ).rows.length,
  0,
);
assert.equal(
  (await as("other", `update work_logs set status='accepted' where id='${row}' returning id`)).rows
    .length,
  0,
);
await assert.rejects(
  as(
    "manager",
    `update work_logs set status='accepted',outcome='Tampered result' where id='${row}'`,
  ),
);
await assert.rejects(as("manager", `update work_logs set status='returned' where id='${row}'`));
await as(
  "manager",
  `update work_logs set status='returned',review_note='Provide evidence' where id='${row}'`,
);
await as(
  "employee",
  `update work_logs set status='draft',outcome='Evidence supplied' where id='${row}'`,
);
await as("employee", `update work_logs set status='submitted' where id='${row}'`);
await as("admin", `update work_logs set status='accepted' where id='${row}'`);
assert.equal(
  (
    await as(
      "employee",
      `update work_logs set description='Edit accepted' where id='${row}' returning id`,
    )
  ).rows.length,
  0,
);
assert.equal((await as("employee", "select * from work_log_history")).rows.length, 6);
assert.equal((await as("other", "select * from work_log_history")).rows.length, 0);
await assert.rejects(as("employee", `delete from work_log_history`));
await db.exec(`reset role; update profiles set is_active=false where id='${ids.employee}';`);
assert.equal((await as("employee", "select * from work_logs")).rows.length, 0);
console.log(
  "PASS: migration, owner isolation, manager scope, review transitions, no self-approval, immutable accepted logs, history and inactive accounts",
);
await db.close();
