// Persistência opcional em Turso (libSQL). Ativa só com TURSO_DATABASE_URL (+ TURSO_AUTH_TOKEN).
// Desenho: sql.js continua a ser a base em memória (leituras síncronas); cada mutação é
// replicada por ordem (fila sequencial) para o Turso. No arranque, a memória é carregada do Turso.
let client=null;
function enabled(){return !!process.env.TURSO_DATABASE_URL}
function getClient(){
  if(!client){const{createClient}=require('@libsql/client');
    client=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN||undefined})}
  return client}
const val=v=>v instanceof ArrayBuffer?new Uint8Array(v):(typeof v==='bigint'?Number(v):v);
const SCHEMA_Q="SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream%' AND name NOT LIKE 'libsql_%' ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END";
// Tem dados? (tabela courses existe e tem linhas)
async function isEmpty(c=getClient()){
  const t=await c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='courses'");
  if(!t.rows.length)return true;
  const n=await c.execute('SELECT COUNT(*) n FROM courses');return Number(n.rows[0].n)===0}
// Turso -> nova sql.js Database
async function loadInto(SQL,c=getClient()){
  const mem=new SQL.Database();const objs=(await c.execute(SCHEMA_Q)).rows;
  for(const o of objs)mem.exec(o.sql);
  for(const o of objs.filter(o=>o.type==='table')){
    const r=await c.execute(`SELECT * FROM "${o.name}"`);if(!r.rows.length)continue;
    const cols=r.columns.map(x=>`"${x}"`).join(','),q=`INSERT INTO "${o.name}"(${cols}) VALUES(${r.columns.map(()=>'?').join(',')})`;
    mem.exec('BEGIN');for(const row of r.rows)mem.run(q,r.columns.map(k=>val(row[k])));mem.exec('COMMIT')}
  return mem}
// sql.js Database -> Turso (substitui tabelas existentes com o mesmo nome)
async function pushAll(mem,c=getClient(),log=()=>{}){
  const objs=[];{const s=mem.prepare(SCHEMA_Q);while(s.step())objs.push(s.getAsObject());s.free()}
  const tables=objs.filter(o=>o.type==='table');
  const ddl=[...tables.map(t=>`DROP TABLE IF EXISTS "${t.name}"`),...objs.map(o=>o.sql)];
  await c.batch(ddl,'write');
  for(const t of tables){
    const s=mem.prepare(`SELECT * FROM "${t.name}"`);let cols=null,buf=[],n=0;
    const flush=async()=>{if(buf.length){await c.batch(buf,'write');n+=buf.length;buf=[]}};
    while(s.step()){if(!cols)cols=s.getColumnNames();
      buf.push({sql:`INSERT INTO "${t.name}"(${cols.map(x=>`"${x}"`).join(',')}) VALUES(${cols.map(()=>'?').join(',')})`,args:s.get()});
      if(buf.length>=200)await flush()}
    s.free();await flush();log(`  ${t.name}: ${n} linhas`)}}
// Fila de replicação ordenada
let chain=Promise.resolve(),pending=0;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const isSqlErr=e=>/SQLITE_|SQL_PARSE|constraint|no such|syntax/i.test(String(e&&(e.code||'')+' '+(e.message||'')));
function enqueue(stmt){ // stmt: {sql,args} ou {multi:sql}
  pending++;
  chain=chain.then(async()=>{for(let i=0;;i++){try{
      if(stmt.multi)await getClient().executeMultiple(stmt.multi);else await getClient().execute(stmt);return}
    catch(e){if(isSqlErr(e)){console.error('[turso] erro SQL (ignorado):',e.message,stmt.sql||stmt.multi);return}
      console.error(`[turso] falha de rede (tentativa ${i+1}), a repetir:`,e.message);await sleep(Math.min(30000,500*2**i))}}})
  .finally(()=>pending--)}
async function flush(timeoutMs=20000){await Promise.race([chain,sleep(timeoutMs)])}
module.exports={enabled,getClient,isEmpty,loadInto,pushAll,enqueue,flush,pendingCount:()=>pending};
