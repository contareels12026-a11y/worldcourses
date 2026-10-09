// SQLite (sql.js / WebAssembly) com persistência em ficheiro data/app.sqlite
const fs=require('fs'),path=require('path'),initSql=require('sql.js');
const FILE=path.join(__dirname,'..','data','app.sqlite');
let db;
const SCHEMA=`
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,pass TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN('user','creator','admin')),created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS courses(id INTEGER PRIMARY KEY,creator_id INTEGER NOT NULL,category TEXT NOT NULL,i18n TEXT NOT NULL,image TEXT,price REAL NOT NULL DEFAULT 12.99,is_free INTEGER DEFAULT 0,badge TEXT DEFAULT 'PREMIUM',source TEXT,published INTEGER DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS lessons(id INTEGER PRIMARY KEY,course_id INTEGER NOT NULL,position INTEGER NOT NULL,i18n TEXT NOT NULL,youtube_id TEXT,video_url TEXT,start_sec INTEGER DEFAULT 0,duration_sec INTEGER NOT NULL,free_preview INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS payments(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL,kind TEXT NOT NULL CHECK(kind IN('lesson','course','subscription')),course_id INTEGER,lesson_id INTEGER,amount REAL NOT NULL,provider TEXT NOT NULL,provider_ref TEXT,status TEXT NOT NULL,starts_at TEXT,ends_at TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS views(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL,lesson_id INTEGER NOT NULL,course_id INTEGER NOT NULL,creator_id INTEGER NOT NULL,seconds REAL DEFAULT 0,pct REAL DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
`;
const DEFAULTS={platform_share:'0.30',w_complete:'1.0',complete_threshold:'0.90',min_pct:'0.10',partial_factor:'1.0'};
async function init(){
  const SQL=await initSql();
  fs.mkdirSync(path.dirname(FILE),{recursive:true});
  db=fs.existsSync(FILE)?new SQL.Database(fs.readFileSync(FILE)):new SQL.Database();
  db.exec(SCHEMA);
  for(const[k,v]of Object.entries(DEFAULTS))run('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)',[k,v]);
  save();
}
let t;function save(){clearTimeout(t);t=setTimeout(()=>fs.writeFileSync(FILE,Buffer.from(db.export())),50)}
function saveNow(){fs.writeFileSync(FILE,Buffer.from(db.export()))}
function all(sql,p=[]){const s=db.prepare(sql);s.bind(p);const r=[];while(s.step())r.push(s.getAsObject());s.free();return r}
function get(sql,p=[]){return all(sql,p)[0]}
function run(sql,p=[]){db.run(sql,p);const id=get('SELECT last_insert_rowid() id').id;save();return id}
function settings(){const o={};for(const r of all('SELECT * FROM settings'))o[r.key]=Number(r.value);return o}
module.exports={init,all,get,run,settings,saveNow,FILE};
