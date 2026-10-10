// Store de sessões persistido na mesma base de dados SQLite (sobrevive a reinícios)
const session=require('express-session'),db=require('./db');
class SqliteStore extends session.Store{
  constructor(){super();db.run('CREATE TABLE IF NOT EXISTS sessions(sid TEXT PRIMARY KEY,sess TEXT NOT NULL,expires INTEGER NOT NULL)');
    setInterval(()=>db.run('DELETE FROM sessions WHERE expires<?',[Date.now()]),36e5).unref()}
  exp(s){return s&&s.cookie&&s.cookie.expires?new Date(s.cookie.expires).getTime():Date.now()+864e5}
  get(sid,cb){try{const r=db.get('SELECT sess,expires FROM sessions WHERE sid=?',[sid]);if(!r||r.expires<Date.now())return cb(null,null);cb(null,JSON.parse(r.sess))}catch(e){cb(e)}}
  set(sid,s,cb){try{db.run('INSERT OR REPLACE INTO sessions(sid,sess,expires) VALUES(?,?,?)',[sid,JSON.stringify(s),this.exp(s)]);cb&&cb(null)}catch(e){cb&&cb(e)}}
  destroy(sid,cb){try{db.run('DELETE FROM sessions WHERE sid=?',[sid]);cb&&cb(null)}catch(e){cb&&cb(e)}}
  touch(sid,s,cb){try{db.run('UPDATE sessions SET expires=? WHERE sid=?',[this.exp(s),sid]);cb&&cb(null)}catch(e){cb&&cb(e)}}
}
module.exports=SqliteStore;
