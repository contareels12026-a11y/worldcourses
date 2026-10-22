// Envia um ficheiro SQLite local para o Turso (SUBSTITUI as tabelas lá existentes).
// Uso: TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npm run db:push-to-turso -- [ficheiro] [--yes]
const fs=require('fs'),path=require('path'),initSql=require('sql.js'),turso=require('../server/turso');
(async()=>{
  const args=process.argv.slice(2),yes=args.includes('--yes');
  const file=args.find(a=>!a.startsWith('--'))||process.env.DB_FILE||path.join(__dirname,'..','data','app.sqlite');
  if(!turso.enabled()){console.error('Define TURSO_DATABASE_URL (e TURSO_AUTH_TOKEN).');process.exit(1)}
  if(!fs.existsSync(file)){console.error('Ficheiro não existe:',file);process.exit(1)}
  if(!(await turso.isEmpty())&&!yes){console.error('O Turso já tem dados. Repete com --yes para os SUBSTITUIR.');process.exit(2)}
  const SQL=await initSql(),mem=new SQL.Database(fs.readFileSync(file));
  console.log('A enviar',file,'->',process.env.TURSO_DATABASE_URL);
  await turso.pushAll(mem,undefined,m=>console.log(m));console.log('Concluído.');
})().catch(e=>{console.error(e);process.exit(1)});
