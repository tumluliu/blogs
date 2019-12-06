---
tags: [Notebooks/blog]
title: Postgresql service can not be stopped on OSX
created: '2016-12-29T12:03:00+01:00'
modified: '2016-12-29T12:03:00+01:00'
---

As I experieced many times before, migrating/upgrating a database always hurts. That's the reason I won't upgrade my Postgresql to the latest version until I have to. And the day finally comes. 

I have to upgrade my Postgresql server from `9.4.9` to `9.6.1` with `pg_upgrade`. Otherwise, I can not properly install `postgis`, which is another long story. I am surely not the first one who is doing this upgrading. [Olivier Lacan](https://gist.github.com/olivierlacan) has [a great post about Postgresql database migrating](https://gist.github.com/olivierlacan/e1bf5c34bc9f82e06bc0). But the thing is, I still can not run the `pg_upgrade` command properly after unloading the `homebrew.mxcl.postgresql.plist`. And the most weird thing is I can not even kill the postgres process even with `kill -9`. After each time I enter the kill command, the postgres services appear again with a new PID just like a ghost virus program. And the `pg_ctl stop` command, of course, doesn't work with whatever `mode` option. Finally, I figure out that there is another `pList` - `homebrew.mxcl.postgresql.plist.bak` still active in the `~/Library/LaunchAgents/` directory. And it IS the control script that starting the current Postgresql service. So I immediatly `launchctl unload` it, then all the postgres services are gone. 

All done? Don't be naive. After running the command

```
pg_upgrade -b /usr/local/Cellar/postgresql94/9.4.9_1/bin -B /usr/local/Cellar/postgresql/9.6.1/bin -d /usr/local/var/postgres.9.4.9.bak -D /usr/local/var/postgres
```

I got the error (from pg_dump_log):

```
command: "/usr/local/Cellar/postgresql/9.6.1/bin/pg_dump" --host '/usr/local/var/log' --port 50432 --username 'user' --schema-only --quote-all-identifiers --binary-upgrade --format=custom  --file="pg_upgrade_dump_16417.custom" 'dbname=mmrp_munich' >> "pg_upgrade_dump_16417.log" 2>&1
pg_dump: [archiver (db)] query failed: ERROR:  could not access file "$libdir/postgis-2.1": No such file or directory
pg_dump: [archiver (db)] query was: SELECT a.attnum, a.attname, a.atttypmod, a.attstattarget, a.attstorage, t.typstorage, a.attnotnull, a.atthasdef, a.attisdropped, a.attlen, a.attalign, a.attislocal, pg_catalog.format_type(t.oid,a.atttypmod) AS atttypname, array_to_string(a.attoptions, ', ') AS attoptions, CASE WHEN a.attcollation <> t.typcollation THEN a.attcollation ELSE 0 END AS attcollation, pg_catalog.array_to_string(ARRAY(SELECT pg_catalog.quote_ident(option_name) || ' ' || pg_catalog.quote_literal(option_value) FROM pg_catalog.pg_options_to_table(attfdwoptions) ORDER BY option_name), E',
    ') AS attfdwoptions FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_type t ON a.atttypid = t.oid WHERE a.attrelid = '28564'::pg_catalog.oid AND a.attnum > 0::pg_catalog.int2 ORDER BY a.attrelid, a.attnum
```

So it's postgis's show time. `could not access file "$libdir/postgis-2.1": No such file or directory`. Of course you could not access the file because it has already upgraded to `2.3`. I tried relaunching the old `9.4.9` server, but failed because all the client toolset are already `9.6.1` which reported incompatibility FATAL error. I feel so helpless. And I think a better workflow should be:

1. Upgrade the postgis extention of your spatial database instances
2. Stop old postgresql service
3. Move old postgresql's data cluster directory to a backup location
4. Install new postgresql server
5. Init new postgresql data cluster (with `initdb`)
6. Stop new postgresql service
7. Upgrade postgresql server (with `pg_upgrade`)

I don't think there are many choices for me. So I decide using [Postgres.app](https://postgresapp.com/) instead, and just give up all the postgresql stuff from Homebrew. I hope that will bring less pain in the future. How about the data? Don't worry, I still have a running database on AWS. 