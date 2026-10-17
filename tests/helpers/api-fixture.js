import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handle } from '../../lib/api.js';

export function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../../migrations/0001_catalog.sql',import.meta.url),'utf8'));
  const DB={
    prepare(sql) {
      const statement=sqlite.prepare(sql);let args=[];
      const wrapped={bind(...values){args=values;return wrapped;},async run(){const result=statement.run(...args);return {meta:{changes:Number(result.changes)}};},async first(){return statement.get(...args)||null;},async all(){return {results:statement.all(...args)};}};return wrapped;
    },
    async batch(statements){sqlite.exec('BEGIN');try{const values=[];for(const statement of statements)values.push(await statement.run());sqlite.exec('COMMIT');return values;}catch(error){sqlite.exec('ROLLBACK');throw error;}}
  };
  const env={DB,ADMIN_PASSWORD:'test-only-admin-password',SESSION_SECRET:'test-secret-with-more-than-thirty-two-characters-123'};
  async function call(path,method='GET',data,session='',extra={}) {
    const headers={'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.15',...extra};if(session)headers.Cookie=session;
    return handle(new Request(`https://example.com/api/${path}`,{method,headers,body:data!==undefined?JSON.stringify(data):undefined}),env);
  }
  async function login(){const response=await call('session','POST',{password:'test-only-admin-password'});assert.equal(response.status,200);return response.headers.get('Set-Cookie').split(';')[0];}
  return {env,call,login,sqlite};
}
