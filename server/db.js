// SQLite (sql.js / WebAssembly) com persistência em ficheiro data/app.sqlite
const fs=require('fs'),path=require('path'),initSql=require('sql.js');
const FILE=process.env.DB_FILE||path.join(__dirname,'..','data','app.sqlite');
let db;
const SCHEMA=`
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,pass TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN('user','creator','admin')),created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS courses(id INTEGER PRIMARY KEY,creator_id INTEGER NOT NULL,category TEXT NOT NULL,i18n TEXT NOT NULL,image TEXT,price REAL NOT NULL DEFAULT 12.99,is_free INTEGER DEFAULT 0,badge TEXT DEFAULT 'PREMIUM',source TEXT,published INTEGER DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS lessons(id INTEGER PRIMARY KEY,course_id INTEGER NOT NULL,position INTEGER NOT NULL,i18n TEXT NOT NULL,youtube_id TEXT,video_url TEXT,start_sec INTEGER DEFAULT 0,duration_sec INTEGER NOT NULL,free_preview INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS payments(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL,kind TEXT NOT NULL CHECK(kind IN('lesson','course','subscription')),course_id INTEGER,lesson_id INTEGER,amount REAL NOT NULL,provider TEXT NOT NULL,provider_ref TEXT,status TEXT NOT NULL,starts_at TEXT,ends_at TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS views(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL,lesson_id INTEGER NOT NULL,course_id INTEGER NOT NULL,creator_id INTEGER NOT NULL,seconds REAL DEFAULT 0,pct REAL DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
`;
const DEFAULTS={launch_date:'2026-10-09',feedback_months:'6',promo_enabled:'1',promo_months:'3',platform_share:'0.30',w_complete:'1.0',complete_threshold:'0.90',min_pct:'0.10',partial_factor:'1.0'};
async function init(){
  const SQL=await initSql();
  fs.mkdirSync(path.dirname(FILE),{recursive:true});
  db=fs.existsSync(FILE)?new SQL.Database(fs.readFileSync(FILE)):new SQL.Database();
  db.exec(SCHEMA);
  for(const q of['ALTER TABLE payments ADD COLUMN stripe_sub TEXT','ALTER TABLE courses ADD COLUMN spoken_language TEXT','ALTER TABLE lessons ADD COLUMN spoken_language TEXT','ALTER TABLE lessons ADD COLUMN has_captions INTEGER DEFAULT 0','ALTER TABLE payments ADD COLUMN promo TEXT'])try{db.exec(q)}catch{}
  db.exec(`CREATE TABLE IF NOT EXISTS site_feedback(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL,course_id INTEGER,rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),comment TEXT,improve TEXT,lang TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS feedback_state(user_id INTEGER PRIMARY KEY,status TEXT NOT NULL,later_course_id INTEGER,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
  backfillLanguages();
  for(const[k,v]of Object.entries(DEFAULTS))run('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)',[k,v]);
  save();
}
let t;function save(){clearTimeout(t);t=setTimeout(()=>fs.writeFileSync(FILE,Buffer.from(db.export())),50)}
function saveNow(){fs.writeFileSync(FILE,Buffer.from(db.export()))}
function all(sql,p=[]){const s=db.prepare(sql);s.bind(p);const r=[];while(s.step())r.push(s.getAsObject());s.free();return r}
function get(sql,p=[]){return all(sql,p)[0]}
function run(sql,p=[]){db.run(sql,p);const id=get('SELECT last_insert_rowid() id').id;save();return id}
function settings(){const o={};for(const r of all('SELECT * FROM settings'))o[r.key]=/^-?\d+(\.\d+)?$/.test(r.value)?Number(r.value):r.value;return o}
// Idioma falado verificado por vídeo (server/video_langs.json) -> preenche aulas/cursos em falta
function backfillLanguages(){let map={};try{map=require('./video_langs.json')}catch{return}
  for(const l of all('SELECT id,youtube_id FROM lessons WHERE spoken_language IS NULL AND youtube_id IS NOT NULL')){const m=map[l.youtube_id];if(m)db.run('UPDATE lessons SET spoken_language=?,has_captions=? WHERE id=?',[m.lang,m.captions,l.id])}
  for(const c of all('SELECT id FROM courses WHERE spoken_language IS NULL')){const r=get(`SELECT spoken_language s,COUNT(*) n FROM lessons WHERE course_id=? AND spoken_language IS NOT NULL AND spoken_language<>'none' GROUP BY s ORDER BY n DESC`,[c.id]);if(r)db.run('UPDATE courses SET spoken_language=? WHERE id=?',[r.s,c.id])}
  save()}
module.exports={backfillLanguages,init,all,get,run,settings,saveNow,FILE};
