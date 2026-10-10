const express=require('express'),session=require('express-session'),bcrypt=require('bcryptjs'),path=require('path');
const db=require('./db'),SqliteStore=require('./sessionStore'),seo=require('./seo'),pay=require('./payments'),payout=require('./payout');
const app=express();
// webhook Stripe precisa do corpo em bruto: montado antes do express.json()
app.post('/webhook',express.raw({type:'application/json',limit:'1mb'}),async(req,res)=>{
  if(pay.MODE!=='stripe_test')return res.status(404).end();
  try{const t=await pay.handleWebhook(req.body,req.headers['stripe-signature']);res.json({received:true,type:t})}
  catch(e){console.error('webhook:',e.message);res.status(400).send('invalid')}});
app.use(express.json());
app.set('trust proxy',1);
let sessionMw;app.use((req,res,next)=>sessionMw(req,res,next)); // criado depois de db.init()
seo.mount(app);
app.use(express.static(path.join(__dirname,'..','public'),{maxAge:'1h',setHeaders:(res,p)=>{if(p.endsWith('.html'))res.set('Cache-Control','no-cache')}}));
app.get('/api/config',(req,res)=>res.json({demo_tools:process.env.DEMO_TOOLS==='1'}));
const me=req=>req.session.uid?db.get('SELECT id,email,name,role FROM users WHERE id=?',[req.session.uid]):null;
const need=(...roles)=>(req,res,next)=>{const u=me(req);if(!u)return res.status(401).json({error:'auth'});if(roles.length&&!roles.includes(u.role))return res.status(403).json({error:'forbidden'});req.user=u;next()};
const L=(o,lang)=>{const j=JSON.parse(o);return j[lang]||j.pt||Object.values(j)[0]};
const subActive=uid=>!!db.get(`SELECT id FROM payments WHERE user_id=? AND kind='subscription' AND status='paid' AND ends_at>datetime('now')`,[uid]);
const subInfo=uid=>db.get(`SELECT ends_at FROM payments WHERE user_id=? AND kind='subscription' AND status='paid' AND ends_at>datetime('now') ORDER BY ends_at DESC`,[uid]);
function canWatch(u,lesson,course){
  if(lesson.free_preview||course.is_free)return true;
  if(!u)return false;
  if(u.role==='admin'||u.id===course.creator_id)return true;
  if(subActive(u.id))return true;
  return !!db.get(`SELECT id FROM payments WHERE user_id=? AND status='paid' AND ((kind='course' AND course_id=?) OR (kind='lesson' AND lesson_id=?))`,[u.id,course.id,lesson.id]);
}
function courseOut(c,lang){const t=JSON.parse(c.i18n),x=t[lang]||t.pt;
  const st=db.get('SELECT COUNT(*) n,SUM(duration_sec) d FROM lessons WHERE course_id=?',[c.id]);
  const r=db.get('SELECT COUNT(*) n,AVG(pct) p FROM views WHERE course_id=?',[c.id]);
  const lg=db.get(`SELECT COUNT(DISTINCT CASE WHEN spoken_language NOT IN('none') THEN spoken_language END) n,MAX(has_captions) cc FROM lessons WHERE course_id=?`,[c.id]);
  return{spoken_language:c.spoken_language||null,mixed_languages:lg.n>1,captions:!!lg.cc,id:c.id,title:x.title,subtitle:x.subtitle,description:x.description,category:c.category,image:c.image,price:c.price,is_free:!!c.is_free,badge:c.is_free?'FREE':c.badge,source:c.source,creator:c.creator_name,creator_id:c.creator_id,lessons:st.n,duration_sec:st.d||0,views:r.n,rating:Math.min(5,4.3+((r.p||0.5)*0.7)).toFixed(1),published:!!c.published}}
const SPOKEN=['pt','en','fr','es','de','it'],SPOKEN_L=[...SPOKEN,'none'];
const COURSE_SQL='SELECT c.*,u.name creator_name FROM courses c JOIN users u ON u.id=c.creator_id';

// ---- auth
app.post('/api/signup',(req,res)=>{const{email,name,password,role}=req.body||{};
  if(!email||!name||!password||password.length<6||!['user','creator'].includes(role))return res.status(400).json({error:'invalid'});
  if(db.get('SELECT id FROM users WHERE email=?',[email.toLowerCase()]))return res.status(409).json({error:'exists'});
  const id=db.run('INSERT INTO users(email,name,pass,role) VALUES(?,?,?,?)',[email.toLowerCase(),name,bcrypt.hashSync(password,10),role]);
  req.session.regenerate(()=>{req.session.uid=id;res.json(me(req))})});
app.post('/api/login',(req,res)=>{const{email,password}=req.body||{};const u=db.get('SELECT * FROM users WHERE email=?',[(email||'').toLowerCase()]);
  if(!u||!bcrypt.compareSync(password||'',u.pass))return res.status(401).json({error:'credentials'});
  req.session.regenerate(()=>{req.session.uid=u.id;res.json(me(req))})});
app.post('/api/logout',(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get('/api/me',(req,res)=>{const u=me(req);if(!u)return res.json(null);const s=subInfo(u.id);res.json({...u,subscription_until:s?s.ends_at:null})});

// ---- catálogo
app.get('/api/courses',(req,res)=>{const lang=req.query.lang||'pt';let rows=db.all(COURSE_SQL+' WHERE c.published=1 ORDER BY c.id');
  if(req.query.category)rows=rows.filter(r=>r.category===req.query.category);
  if(req.query.spoken)rows=rows.filter(r=>r.spoken_language===req.query.spoken);
  res.json(rows.map(c=>courseOut(c,lang)))});
app.get('/api/courses/:id',(req,res)=>{const lang=req.query.lang||'pt',u=me(req);
  const c=db.get(COURSE_SQL+' WHERE c.id=?',[+req.params.id]);if(!c)return res.status(404).json({error:'notfound'});
  const lessons=db.all('SELECT * FROM lessons WHERE course_id=? ORDER BY position',[c.id]).map(l=>{const ok=canWatch(u,l,c);
    return{id:l.id,position:l.position,title:L(l.i18n,lang),duration_sec:l.duration_sec,free_preview:!!l.free_preview,unlocked:ok,price:pay.PRICES.lesson,spoken_language:l.spoken_language||c.spoken_language,has_captions:!!l.has_captions}});
  const owned=u&&!!db.get(`SELECT id FROM payments WHERE user_id=? AND kind='course' AND course_id=? AND status='paid'`,[u.id,c.id]);
  res.json({...courseOut(c,lang),lessons,owned,subscribed:u?subActive(u.id):false})});
// O ID do vídeo só é revelado se o acesso for autorizado no servidor
app.get('/api/lessons/:id/play',(req,res)=>{const u=me(req);const l=db.get('SELECT * FROM lessons WHERE id=?',[+req.params.id]);if(!l)return res.status(404).end();
  const c=db.get('SELECT * FROM courses WHERE id=?',[l.course_id]);
  if(!canWatch(u,l,c))return res.status(402).json({error:'payment_required',lesson_price:pay.PRICES.lesson,course_price:c.price,subscription:pay.PRICES.subscription});
  res.json({youtube_id:l.youtube_id,video_url:l.video_url,start:l.start_sec,duration_sec:l.duration_sec,can_track:!!u,spoken_language:l.spoken_language||c.spoken_language,has_captions:!!l.has_captions})});
// tracking: cria ou atualiza um evento de visualização
app.post('/api/views',need(),(req,res)=>{const{lesson_id,view_id,seconds}=req.body||{};const l=db.get('SELECT * FROM lessons WHERE id=?',[+lesson_id]);if(!l)return res.status(404).end();
  const c=db.get('SELECT * FROM courses WHERE id=?',[l.course_id]);if(!canWatch(req.user,l,c))return res.status(402).end();
  const secs=Math.max(0,Math.min(Number(seconds)||0,l.duration_sec)),pct=secs/l.duration_sec;
  if(view_id){const v=db.get('SELECT * FROM views WHERE id=? AND user_id=?',[+view_id,req.user.id]);if(v){db.run(`UPDATE views SET seconds=MAX(seconds,?),pct=MAX(pct,?),updated_at=CURRENT_TIMESTAMP WHERE id=?`,[secs,pct,v.id]);return res.json({view_id:v.id})}}
  const id=db.run('INSERT INTO views(user_id,lesson_id,course_id,creator_id,seconds,pct) VALUES(?,?,?,?,?,?)',[req.user.id,l.id,c.id,c.creator_id,secs,pct]);res.json({view_id:id})});

// ---- checkout (MOCK / TESTE)
// Promo de lançamento: €29,99/mês para TODAS as subscrições desde LAUNCH_DATE até LAUNCH_DATE + promo_months; depois €39,99
function promoEnd(){const s=db.settings();const d=new Date(String(s.launch_date)+'T00:00:00Z');if(isNaN(d))return null;d.setUTCMonth(d.getUTCMonth()+Number(s.promo_months||0));return d}
function promoActive(){const s=db.settings(),e=promoEnd(),st=new Date(String(s.launch_date)+'T00:00:00Z');return s.promo_enabled===1&&!!e&&new Date()>=st&&new Date()<e}
app.get('/api/pricing',(req,res)=>{const e=promoEnd();res.json({...pay.PRICES,mode:pay.MODE,promo:promoActive()?{price:pay.PROMO.price,until:e.toISOString().slice(0,10)}:null})});
app.post('/api/checkout',need('user','creator','admin'),async(req,res)=>{const{kind,course_id,lesson_id}=req.body||{};let amount,cid=null,lid=null,starts=null,ends=null;
  let promo=false;
  if(kind==='subscription'){promo=promoActive();amount=pay.PRICES.subscription;const cur=subInfo(req.user.id);starts=cur?cur.ends_at:new Date().toISOString().replace('T',' ').slice(0,19);
    ends=db.get(`SELECT datetime(?,'+1 month') e`,[starts]).e}
  else if(kind==='course'){const c=db.get('SELECT * FROM courses WHERE id=?',[+course_id]);if(!c||c.is_free)return res.status(400).json({error:'invalid'});amount=c.price;cid=c.id}
  else if(kind==='lesson'){const l=db.get('SELECT * FROM lessons WHERE id=?',[+lesson_id]);if(!l)return res.status(400).json({error:'invalid'});amount=pay.PRICES.lesson;lid=l.id;cid=l.course_id}
  else return res.status(400).json({error:'invalid'});
  if(pay.MODE==='stripe_test'){try{const origin=process.env.PUBLIC_URL||`${req.protocol}://${req.get('host')}`;
    const r=await pay.createCheckout({user:req.user,kind,amount,promo:promo?promoEnd():null,course_id:cid,lesson_id:lid,origin:origin.replace(/\/$/,''),returnPath:req.body.return_path&&String(req.body.return_path).startsWith('/')&&!String(req.body.return_path).startsWith('//')?req.body.return_path:'/'});
    return res.json({ok:true,mode:pay.MODE,url:r.url,session_id:r.id,amount})}catch(e){console.error('checkout:',e.message);return res.status(502).json({error:'stripe'})}}
  // mock: durante a janela de lançamento cobra o preço promocional (sem renovações automáticas em mock)
  if(promo)amount=pay.PROMO.price;
  const r=await pay.charge({kind,amount,user:req.user});
  db.run('INSERT INTO payments(user_id,kind,course_id,lesson_id,amount,provider,provider_ref,status,starts_at,ends_at,promo) VALUES(?,?,?,?,?,?,?,?,?,?,?)',[req.user.id,kind,cid,lid,amount,r.provider,r.ref,r.status,starts,ends,promo?'launch_window':null]);
  res.json({ok:true,mode:pay.MODE,ref:r.ref,amount})});
// regresso do Stripe Checkout: verificação no servidor (sessão obtida à API), concede acesso de imediato
app.get('/checkout/success',async(req,res)=>{if(pay.MODE!=='stripe_test')return res.redirect('/');
  try{const r=await pay.fulfillSession(String(req.query.session_id||''));const back=(r.session&&r.session.metadata&&r.session.metadata.return_path)||'/';
    const safe=back.startsWith('/')&&!back.startsWith('//')?back:'/';res.redirect(safe+(safe.includes('?')?'&':'?')+'checkout='+(r.ok?'success':'pending'))}
  catch(e){console.error('success:',e.message);res.redirect('/?checkout=error')}});

// ---- criador
app.get('/api/creator/courses',need('creator','admin'),(req,res)=>res.json(db.all(COURSE_SQL+' WHERE c.creator_id=? ORDER BY c.id DESC',[req.user.id]).map(c=>({...courseOut(c,req.query.lang||'pt'),i18n:JSON.parse(c.i18n)}))));
app.post('/api/creator/courses',need('creator','admin'),(req,res)=>{const b=req.body||{};
  if(!b.title||!b.category||!Array.isArray(b.lessons)||!b.lessons.length)return res.status(400).json({error:'invalid'});
  if(!SPOKEN.includes(b.spoken_language))return res.status(400).json({error:'spoken_language_required',field:'spoken_language'});
  for(const l of b.lessons)if(!SPOKEN_L.includes(l.spoken_language))return res.status(400).json({error:'spoken_language_required',field:'lesson.spoken_language'});
  const isFree=b.price==='free'||Number(b.price)===0,price=isFree?0:(pay.PRICES.course_tiers.includes(Number(b.price))?Number(b.price):12.99);
  const t={title:b.title,subtitle:b.subtitle||'',description:b.description||''};
  const id=db.run('INSERT INTO courses(creator_id,category,i18n,image,price,is_free,badge,source,spoken_language) VALUES(?,?,?,?,?,?,?,?,?)',[req.user.id,b.category,JSON.stringify({pt:t,en:t,fr:t}),b.image||'assets/img'+(1+Math.floor(Math.random()*12))+'.jpg',price,isFree?1:0,isFree?'FREE':(price>5?'PREMIUM':'ESSENTIAL'),b.source||'',b.spoken_language]);
  b.lessons.forEach((l,i)=>{const yt=(String(l.video||'').match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/)||[])[1]||(/^[\w-]{11}$/.test(l.video||'')?l.video:null);
    db.run('INSERT INTO lessons(course_id,position,i18n,youtube_id,video_url,duration_sec,free_preview,spoken_language,has_captions) VALUES(?,?,?,?,?,?,?,?,?)',[id,i+1,JSON.stringify({pt:l.title,en:l.title,fr:l.title}),yt,yt?null:(l.video||null),Math.max(60,Math.round((Number(l.minutes)||5)*60)),l.free_preview?1:0,l.spoken_language,yt&&l.spoken_language!=='none'?1:0])});
  res.json({id})});
app.put('/api/creator/courses/:id/language',need('creator','admin'),(req,res)=>{const c=db.get('SELECT * FROM courses WHERE id=?',[+req.params.id]);
  if(!c||(c.creator_id!==req.user.id&&req.user.role!=='admin'))return res.status(404).end();
  if(!SPOKEN.includes(req.body.spoken_language))return res.status(400).json({error:'spoken_language_required'});
  db.run('UPDATE courses SET spoken_language=? WHERE id=?',[req.body.spoken_language,c.id]);
  db.run("UPDATE lessons SET spoken_language=? WHERE course_id=? AND (spoken_language IS NULL OR spoken_language=?)",[req.body.spoken_language,c.id,c.spoken_language||'']);res.json({ok:true})});
app.get('/api/creator/stats',need('creator','admin'),(req,res)=>{const r=payout.compute(req.query.month);const mine=r.table.find(x=>x.creator_id===req.user.id)||{views:0,completions:0,partial:0,ignored:0,watch_minutes:0,weight:0,share:0,earnings:0};
  const perCourse=db.all(`SELECT c.id,c.i18n,COUNT(v.id) views,SUM(CASE WHEN v.pct>=? THEN 1 ELSE 0 END) completions,ROUND(SUM(v.seconds)/60.0,1) minutes FROM courses c LEFT JOIN views v ON v.course_id=c.id AND v.created_at>=? AND v.created_at<? AND v.user_id<>c.creator_id WHERE c.creator_id=? GROUP BY c.id`,[r.settings.complete_threshold,r.period.start,r.period.end,req.user.id]).map(x=>({id:x.id,title:L(x.i18n,req.query.lang||'pt').title,views:x.views,completions:x.completions,minutes:x.minutes||0}));
  res.json({period:r.period,settings:r.settings,pool:r.pool,gross:r.gross,total_weight:r.total_weight,mine,perCourse})});

// ---- feedback sobre a plataforma (apenas respostas reais; nada é semeado)
function feedbackWindow(){const s=db.settings();const start=new Date(String(s.launch_date)+'T00:00:00Z');if(isNaN(start))return false;const end=new Date(start);end.setUTCMonth(end.getUTCMonth()+Number(s.feedback_months||0));const now=new Date();return now>=start&&now<end}
function courseProgress(uid,cid){const ls=db.all(`SELECT l.id,l.duration_sec,(SELECT MAX(pct) FROM views v WHERE v.user_id=? AND v.lesson_id=l.id) p FROM lessons l WHERE l.course_id=?`,[uid,cid]);
  if(!ls.length)return 0;const s=db.settings();const tot=ls.reduce((a,l)=>a+l.duration_sec,0);
  const watch=ls.reduce((a,l)=>a+Math.min(1,l.p||0)*l.duration_sec,0)/tot,done=ls.filter(l=>(l.p||0)>=s.complete_threshold).length/ls.length;return Math.max(watch,done)}
app.get('/api/feedback/should',need(),(req,res)=>{const cid=+req.query.course_id;
  if(!feedbackWindow())return res.json({ask:false,reason:'window'});
  const st=db.get('SELECT * FROM feedback_state WHERE user_id=?',[req.user.id]);
  if(st&&(st.status==='answered'||st.status==='dismissed'))return res.json({ask:false,reason:st.status});
  if(st&&st.status==='later'&&st.later_course_id===cid)return res.json({ask:false,reason:'later_same_course'});
  const p=courseProgress(req.user.id,cid);res.json({ask:p>=0.5,progress:Math.round(p*100)/100,second_time:!!st})});
app.post('/api/feedback',need(),(req,res)=>{const{action,course_id}=req.body||{};const cid=+course_id||null;
  const st=db.get('SELECT * FROM feedback_state WHERE user_id=?',[req.user.id]);
  if(st&&(st.status==='answered'||st.status==='dismissed'))return res.status(409).json({error:'done'});
  const setState=(s,c)=>db.run('INSERT INTO feedback_state(user_id,status,later_course_id) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET status=excluded.status,later_course_id=excluded.later_course_id,updated_at=CURRENT_TIMESTAMP',[req.user.id,s,c]);
  if(action==='later'){setState(st&&st.status==='later'?'dismissed':'later',cid);return res.json({ok:true})} // só volta a perguntar uma vez
  if(action==='dismiss'){setState('dismissed',cid);return res.json({ok:true})}
  if(action!=='submit')return res.status(400).json({error:'invalid'});
  if(!feedbackWindow())return res.status(403).json({error:'window'});
  const rating=Math.round(Number(req.body.rating));if(!(rating>=1&&rating<=5))return res.status(400).json({error:'invalid'});
  db.run('INSERT INTO site_feedback(user_id,course_id,rating,comment,improve,lang) VALUES(?,?,?,?,?,?)',[req.user.id,cid,rating,String(req.body.comment||'').trim().slice(0,2000),String(req.body.improve||'').trim().slice(0,2000),String(req.body.lang||'').slice(0,5)]);
  setState('answered',cid);res.json({ok:true})});
app.get('/api/admin/feedback',need('admin'),(req,res)=>{const items=db.all('SELECT f.*,u.name,u.email FROM site_feedback f JOIN users u ON u.id=f.user_id ORDER BY f.created_at DESC');
  const a=db.get('SELECT COUNT(*) n,AVG(rating) avg FROM site_feedback');res.json({count:a.n,avg:a.n?Math.round(a.avg*100)/100:null,items,window:feedbackWindow()})});
app.get('/api/admin/feedback.csv',need('admin'),(req,res)=>{const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const rows=db.all('SELECT f.created_at,u.name,u.email,f.rating,f.comment,f.improve,f.course_id,f.lang FROM site_feedback f JOIN users u ON u.id=f.user_id ORDER BY f.created_at');
  res.set('Content-Disposition','attachment; filename="site_feedback.csv"').type('text/csv').send('\ufeff'+['created_at,name,email,rating,comment,improve,course_id,lang',...rows.map(r=>[r.created_at,r.name,r.email,r.rating,r.comment,r.improve,r.course_id,r.lang].map(q).join(','))].join('\r\n'))});

// ---- admin
app.get('/api/admin/payouts',need('admin'),(req,res)=>res.json(payout.compute(req.query.month)));
app.get('/api/admin/settings',need('admin'),(req,res)=>res.json(db.settings()));
app.put('/api/admin/settings',need('admin'),(req,res)=>{const lim={platform_share:[0,0.9],w_complete:[0,10],complete_threshold:[0.5,1],min_pct:[0,0.5],partial_factor:[0,2]};
  for(const[k,[a,b]]of Object.entries(lim))if(req.body[k]!==undefined){const v=Number(req.body[k]);if(isNaN(v)||v<a||v>b)return res.status(400).json({error:'invalid',field:k});db.run('UPDATE settings SET value=? WHERE key=?',[String(v),k])}
  if(req.body.launch_date!==undefined){if(!/^\d{4}-\d{2}-\d{2}$/.test(req.body.launch_date))return res.status(400).json({error:'invalid',field:'launch_date'});db.run('UPDATE settings SET value=? WHERE key=?',[req.body.launch_date,'launch_date'])}
  if(req.body.promo_months!==undefined){const v=Math.round(Number(req.body.promo_months));if(!(v>=0&&v<=24))return res.status(400).json({error:'invalid',field:'promo_months'});db.run('UPDATE settings SET value=? WHERE key=?',[String(v),'promo_months'])}
  if(req.body.feedback_months!==undefined){const v=Math.round(Number(req.body.feedback_months));if(!(v>=0&&v<=36))return res.status(400).json({error:'invalid',field:'feedback_months'});db.run('UPDATE settings SET value=? WHERE key=?',[String(v),'feedback_months'])}
  if(req.body.promo_enabled!==undefined)db.run('UPDATE settings SET value=? WHERE key=?',[req.body.promo_enabled==='1'||req.body.promo_enabled===1||req.body.promo_enabled===true?'1':'0','promo_enabled']);
  res.json(db.settings())});

const PORT=process.env.PORT||3000;
db.init().then(async()=>{try{await pay.setup()}catch(e){console.error('Stripe setup falhou:',e.message)}pay.startPromoJob(()=>promoEnd());sessionMw=session({store:new SqliteStore(),secret:process.env.SESSION_SECRET||'dev-secret-change-me',resave:false,saveUninitialized:false,rolling:true,cookie:{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production'?'auto':false,maxAge:7*864e5}});app.listen(PORT,()=>console.log(`The World Courses em http://localhost:${PORT} (pagamentos: ${pay.MODE}, demo tools: ${process.env.DEMO_TOOLS==='1'})`))});
for(const s of['SIGTERM','SIGINT'])process.on(s,()=>{try{db.saveNow()}catch{}process.exit(0)});
