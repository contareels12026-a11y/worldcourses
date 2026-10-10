// ===== Pagamentos: Stripe em MODO DE TESTE, ou mock quando não há chave =====
// Variáveis: STRIPE_SECRET_KEY (sk_test_… obrigatório para Stripe), STRIPE_WEBHOOK_SECRET (whsec_…, opcional)
// Chaves sk_live_/rk_live_ são recusadas: nenhuma cobrança real é possível.
const db=require('./db');
const PRICES={lesson:4.99,course_tiers:[4.99,12.99],subscription:39.99};
const KEY=process.env.STRIPE_SECRET_KEY||'';
if(/^(sk|rk)_live_/.test(KEY)){console.error('ERRO: chaves Stripe LIVE não são permitidas. Use uma chave sk_test_.');process.exit(1)}
if(KEY&&!KEY.startsWith('sk_test_')){console.error('ERRO: STRIPE_SECRET_KEY inválida (esperado sk_test_…).');process.exit(1)}
const MODE=KEY?'stripe_test':'mock';
const stripe=KEY?require('stripe')(KEY):null;
// lookup_key -> definição; criados idempotentemente no arranque
const CATALOG={
  wc_lesson_499:{amount:499,name:'The World Courses — Aula individual'},
  wc_course_499:{amount:499,name:'The World Courses — Curso (escalão €4,99)'},
  wc_course_1299:{amount:1299,name:'The World Courses — Curso (escalão €12,99)'},
  wc_sub_3999:{amount:3999,name:'The World Courses — All Access (mensal)',recurring:{interval:'month'}},
};
const priceIds={};
async function setup(){
  if(!stripe)return;
  const acct=await stripe.balance.retrieve();if(acct.livemode)throw new Error('Stripe devolveu livemode=true — recusado');
  const {data}=await stripe.prices.list({lookup_keys:Object.keys(CATALOG),active:true,limit:20});
  for(const p of data)priceIds[p.lookup_key]=p.id;
  for(const[lk,d]of Object.entries(CATALOG)){if(priceIds[lk])continue;
    const p=await stripe.prices.create({currency:'eur',unit_amount:d.amount,lookup_key:lk,transfer_lookup_key:true,product_data:{name:d.name,metadata:{app:'worldcourses'}},...(d.recurring?{recurring:d.recurring}:{})},{idempotencyKey:'wc-price-'+lk+'-v1'});
    priceIds[lk]=p.id}
  console.log('Stripe (teste) pronto:',Object.keys(priceIds).length,'preços');
}
function lookupFor(kind,amount){if(kind==='subscription')return'wc_sub_3999';if(kind==='lesson')return'wc_lesson_499';return amount>5?'wc_course_1299':'wc_course_499'}
async function createCheckout({user,kind,amount,course_id,lesson_id,origin,returnPath}){
  const meta={app:'worldcourses',user_id:String(user.id),kind,course_id:String(course_id||''),lesson_id:String(lesson_id||''),return_path:String(returnPath||'/').slice(0,400)};
  const s=await stripe.checkout.sessions.create({
    mode:kind==='subscription'?'subscription':'payment',
    line_items:[{price:priceIds[lookupFor(kind,amount)],quantity:1}],
    client_reference_id:String(user.id),customer_email:user.email,metadata:meta,
    ...(kind==='subscription'?{subscription_data:{metadata:meta}}:{payment_intent_data:{metadata:meta}}),
    success_url:`${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:`${origin}${meta.return_path}${meta.return_path.includes('?')?'&':'?'}checkout=cancel`});
  return{url:s.url,id:s.id};
}
const iso=ts=>new Date(ts*1000).toISOString().replace('T',' ').slice(0,19);
const exists=ref=>!!db.get('SELECT id FROM payments WHERE provider_ref=?',[ref]);
// Registo idempotente nas tabelas de receita (payments), usadas pelo cálculo de pagamentos a criadores
function recordOneTime(s){
  if(s.payment_status!=='paid'||exists(s.id))return false;const m=s.metadata||{};
  db.run(`INSERT INTO payments(user_id,kind,course_id,lesson_id,amount,provider,provider_ref,status) VALUES(?,?,?,?,?,?,?,?)`,
    [+m.user_id,m.kind,m.course_id?+m.course_id:null,m.lesson_id?+m.lesson_id:null,s.amount_total/100,'stripe_test',s.id,'paid']);return true}
function recordInvoice(inv,sub,meta){
  if(inv.status!=='paid'||exists(inv.id))return false;const m=meta||(sub&&sub.metadata)||{};if(!m.user_id)return false;
  const line=inv.lines&&inv.lines.data&&inv.lines.data[0],per=(line&&line.period)||{start:inv.period_start,end:inv.period_end};
  db.run(`INSERT INTO payments(user_id,kind,amount,provider,provider_ref,status,starts_at,ends_at,stripe_sub) VALUES(?,?,?,?,?,?,?,?,?)`,
    [+m.user_id,'subscription',inv.amount_paid/100,'stripe_test',inv.id,'paid',iso(per.start),iso(per.end),(typeof inv.subscription==='string'?inv.subscription:null)||(inv.parent&&inv.parent.subscription_details&&inv.parent.subscription_details.subscription)||(sub&&sub.id)||null]);return true}
async function fulfillSession(sessionId){
  const s=await stripe.checkout.sessions.retrieve(sessionId,{expand:['invoice','subscription']});
  if(s.livemode||(s.metadata||{}).app!=='worldcourses')return{ok:false};
  if(s.mode==='payment'){recordOneTime(s);return{ok:s.payment_status==='paid',session:s}}
  if(s.mode==='subscription'&&s.invoice){recordInvoice(s.invoice,s.subscription,s.metadata);return{ok:s.invoice.status==='paid',session:s}}
  return{ok:false,session:s};
}
// Webhook: com STRIPE_WEBHOOK_SECRET verifica a assinatura; sem ele, volta a obter o evento à API da Stripe (nunca confia no corpo)
async function handleWebhook(raw,sig){
  let ev;const secret=process.env.STRIPE_WEBHOOK_SECRET;
  if(secret)ev=stripe.webhooks.constructEvent(raw,sig,secret);
  else{const id=JSON.parse(raw.toString()).id;ev=await stripe.events.retrieve(id)}
  if(ev.livemode)return;
  const o=ev.data.object;
  if(ev.type==='checkout.session.completed'||ev.type==='checkout.session.async_payment_succeeded')await fulfillSession(o.id);
  else if(ev.type==='invoice.paid'||ev.type==='invoice.payment_succeeded'){const subId=o.subscription||(o.parent&&o.parent.subscription_details&&o.parent.subscription_details.subscription);
    if(subId){const sub=await stripe.subscriptions.retrieve(subId);if((sub.metadata||{}).app==='worldcourses')recordInvoice({...o,subscription:subId},sub,sub.metadata)}}
  else if(ev.type==='customer.subscription.deleted'){db.run(`UPDATE payments SET ends_at=MIN(ends_at,datetime('now')) WHERE stripe_sub=?`,[o.id])}
  return ev.type;
}
async function charge({kind,amount}){ // modo mock
  return{provider:'mock',ref:'mock_'+kind+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),status:'paid',amount};
}
module.exports={PRICES,MODE,setup,createCheckout,fulfillSession,handleWebhook,charge,stripe:()=>stripe};
