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
  return{id:c.id,title:x.title,subtitle:x.subtitle,description:x.description,category:c.category,image:c.image,price:c.price,is_free:!!c.is_free,badge:c.is_free?'FREE':c.badge,source:c.source,creator:c.creator_name,creator_id:c.creator_id,lessons:st.n,duration_sec:st.d||0,views:r.n,rating:Math.min(5,4.3+((r.p||0.5)*0.7)).toFixed(1),published:!!c.published}}
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
  res.json(rows.map(c=>courseOut(c,lang)))});
app.get('/api/courses/:id',(req,res)=>{const lang=req.query.lang||'pt',u=me(req);
  const c=db.get(COURSE_SQL+' WHERE c.id=?',[+req.params.id]);if(!c)return res.status(404).json({error:'notfound'});
  const lessons=db.all('SELECT * FROM lessons WHERE course_id=? ORDER BY position',[c.id]).map(l=>{const ok=canWatch(u,l,c);
    return{id:l.id,position:l.position,title:L(l.i18n,lang),duration_sec:l.duration_sec,free_preview:!!l.free_preview,unlocked:ok,price:pay.PRICES.lesson}});
  const owned=u&&!!db.get(`SELECT id FROM payments WHERE user_id=? AND kind='course' AND course_id=? AND status='paid'`,[u.id,c.id]);
  res.json({...courseOut(c,lang),lessons,owned,subscribed:u?subActive(u.id):false})});
// O ID do vídeo só é revelado se o acesso for autorizado no servidor
app.get('/api/lessons/:id/play',(req,res)=>{const u=me(req);const l=db.get('SELECT * FROM lessons WHERE id=?',[+req.params.id]);if(!l)return res.status(404).end();
  const c=db.get('SELECT * FROM courses WHERE id=?',[l.course_id]);
  if(!canWatch(u,l,c))return res.status(402).json({error:'payment_required',lesson_price:pay.PRICES.lesson,course_price:c.price,subscription:pay.PRICES.subscription});
  res.json({youtube_id:l.youtube_id,video_url:l.video_url,start:l.start_sec,duration_sec:l.duration_sec,can_track:!!u})});
// tracking: cria ou atualiza um evento de visualização
app.post('/api/views',need(),(req,res)=>{const{lesson_id,view_id,seconds}=req.body||{};const l=db.get('SELECT * FROM lessons WHERE id=?',[+lesson_id]);if(!l)return res.status(404).end();
  const c=db.get('SELECT * FROM courses WHERE id=?',[l.course_id]);if(!canWatch(req.user,l,c))return res.status(402).end();
  const secs=Math.max(0,Math.min(Number(seconds)||0,l.duration_sec)),pct=secs/l.duration_sec;
  if(view_id){const v=db.get('SELECT * FROM views WHERE id=? AND user_id=?',[+view_id,req.user.id]);if(v){db.run(`UPDATE views SET seconds=MAX(seconds,?),pct=MAX(pct,?),updated_at=CURRENT_TIMESTAMP WHERE id=?`,[secs,pct,v.id]);return res.json({view_id:v.id})}}
  const id=db.run('INSERT INTO views(user_id,lesson_id,course_id,creator_id,seconds,pct) VALUES(?,?,?,?,?,?)',[req.user.id,l.id,c.id,c.creator_id,secs,pct]);res.json({view_id:id})});

// ---- checkout (MOCK / TESTE)
app.get('/api/pricing',(req,res)=>res.json({...pay.PRICES,mode:pay.MODE}));
app.post('/api/checkout',need('user','creator','admin'),async(req,res)=>{const{kind,course_id,lesson_id}=req.body||{};let amount,cid=null,lid=null,starts=null,ends=null;
  if(kind==='subscription'){amount=pay.PRICES.subscription;const cur=subInfo(req.user.id);starts=cur?cur.ends_at:new Date().toISOString().replace('T',' ').slice(0,19);
    ends=db.get(`SELECT datetime(?,'+1 month') e`,[starts]).e}
  else if(kind==='course'){const c=db.get('SELECT * FROM courses WHERE id=?',[+course_id]);if(!c||c.is_free)return res.status(400).json({error:'invalid'});amount=c.price;cid=c.id}
  else if(kind==='lesson'){const l=db.get('SELECT * FROM lessons WHERE id=?',[+lesson_id]);if(!l)return res.status(400).json({error:'invalid'});amount=pay.PRICES.lesson;lid=l.id;cid=l.course_id}
  else return res.status(400).json({error:'invalid'});
  if(pay.MODE==='stripe_test'){try{const origin=process.env.PUBLIC_URL||`${req.protocol}://${req.get('host')}`;
    const r=await pay.createCheckout({user:req.user,kind,amount,course_id:cid,lesson_id:lid,origin:origin.replace(/\/$/,''),returnPath:req.body.return_path&&String(req.body.return_path).startsWith('/')&&!String(req.body.return_path).startsWith('//')?req.body.return_path:'/'});
    return res.json({ok:true,mode:pay.MODE,url:r.url,session_id:r.id,amount})}catch(e){console.error('checkout:',e.message);return res.status(502).json({error:'stripe'})}}
  const r=await pay.charge({kind,amount,user:req.user});
  db.run('INSERT INTO payments(user_id,kind,course_id,lesson_id,amount,provider,provider_ref,status,starts_at,ends_at) VALUES(?,?,?,?,?,?,?,?,?,?)',[req.user.id,kind,cid,lid,amount,r.provider,r.ref,r.status,starts,ends]);
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
  const isFree=b.price==='free'||Number(b.price)===0,price=isFree?0:(pay.PRICES.course_tiers.includes(Number(b.price))?Number(b.price):12.99);
  const t={title:b.title,subtitle:b.subtitle||'',description:b.description||''};
  const id=db.run('INSERT INTO courses(creator_id,category,i18n,image,price,is_free,badge,source) VALUES(?,?,?,?,?,?,?,?)',[req.user.id,b.category,JSON.stringify({pt:t,en:t,fr:t}),b.image||'assets/img'+(1+Math.floor(Math.random()*12))+'.jpg',price,isFree?1:0,isFree?'FREE':(price>5?'PREMIUM':'ESSENTIAL'),b.source||'']);
  b.lessons.forEach((l,i)=>{const yt=(String(l.video||'').match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/)||[])[1]||(/^[\w-]{11}$/.test(l.video||'')?l.video:null);
    db.run('INSERT INTO lessons(course_id,position,i18n,youtube_id,video_url,duration_sec,free_preview) VALUES(?,?,?,?,?,?,?)',[id,i+1,JSON.stringify({pt:l.title,en:l.title,fr:l.title}),yt,yt?null:(l.video||null),Math.max(60,Math.round((Number(l.minutes)||5)*60)),l.free_preview?1:0])});
  res.json({id})});
app.get('/api/creator/stats',need('creator','admin'),(req,res)=>{const r=payout.compute(req.query.month);const mine=r.table.find(x=>x.creator_id===req.user.id)||{views:0,completions:0,partial:0,ignored:0,watch_minutes:0,weight:0,share:0,earnings:0};
  const perCourse=db.all(`SELECT c.id,c.i18n,COUNT(v.id) views,SUM(CASE WHEN v.pct>=? THEN 1 ELSE 0 END) completions,ROUND(SUM(v.seconds)/60.0,1) minutes FROM courses c LEFT JOIN views v ON v.course_id=c.id AND v.created_at>=? AND v.created_at<? AND v.user_id<>c.creator_id WHERE c.creator_id=? GROUP BY c.id`,[r.settings.complete_threshold,r.period.start,r.period.end,req.user.id]).map(x=>({id:x.id,title:L(x.i18n,req.query.lang||'pt').title,views:x.views,completions:x.completions,minutes:x.minutes||0}));
  res.json({period:r.period,settings:r.settings,pool:r.pool,gross:r.gross,total_weight:r.total_weight,mine,perCourse})});

// ---- admin
app.get('/api/admin/payouts',need('admin'),(req,res)=>res.json(payout.compute(req.query.month)));
app.get('/api/admin/settings',need('admin'),(req,res)=>res.json(db.settings()));
app.put('/api/admin/settings',need('admin'),(req,res)=>{const lim={platform_share:[0,0.9],w_complete:[0,10],complete_threshold:[0.5,1],min_pct:[0,0.5],partial_factor:[0,2]};
  for(const[k,[a,b]]of Object.entries(lim))if(req.body[k]!==undefined){const v=Number(req.body[k]);if(isNaN(v)||v<a||v>b)return res.status(400).json({error:'invalid',field:k});db.run('UPDATE settings SET value=? WHERE key=?',[String(v),k])}
  res.json(db.settings())});

const PORT=process.env.PORT||3000;
db.init().then(async()=>{try{await pay.setup()}catch(e){console.error('Stripe setup falhou:',e.message)}sessionMw=session({store:new SqliteStore(),secret:process.env.SESSION_SECRET||'dev-secret-change-me',resave:false,saveUninitialized:false,rolling:true,cookie:{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production'?'auto':false,maxAge:7*864e5}});app.listen(PORT,()=>console.log(`The World Courses em http://localhost:${PORT} (pagamentos: ${pay.MODE}, demo tools: ${process.env.DEMO_TOOLS==='1'})`))});
for(const s of['SIGTERM','SIGINT'])process.on(s,()=>{try{db.saveNow()}catch{}process.exit(0)});
