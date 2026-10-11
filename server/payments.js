// ===== Pagamentos: Stripe em MODO DE TESTE, ou mock quando não há chave =====
// Variáveis: STRIPE_SECRET_KEY (sk_test_… obrigatório para Stripe), STRIPE_WEBHOOK_SECRET (whsec_…, opcional)
// Chaves sk_live_/rk_live_ são recusadas: nenhuma cobrança real é possível.
const db=require('./db');
const PRICES={lesson:4.99,course_tiers:[4.99,12.99],subscription:39.99};
// Promo de lançamento: cupão "forever" de €10 com redeem_by = fim da janela + subscription schedule que,
// no fim da janela, muda para uma fase sem desconto (€39,99). Um job horário remove ainda descontos residuais.
const PROMO={amount_off:1000,price:29.99};
const couponId=end=>'wc_launch_until_'+end.toISOString().slice(0,10).replace(/-/g,'');
async function ensureCoupon(end){const id=couponId(end);
  try{return(await stripe.coupons.retrieve(id)).id}catch(e){if(e.statusCode!==404)throw e}
  return(await stripe.coupons.create({id,amount_off:PROMO.amount_off,currency:'eur',duration:'forever',redeem_by:Math.floor(end/1000),name:'Lançamento €29,99 até '+end.toISOString().slice(0,10)},{idempotencyKey:'wc-coupon-'+id})).id}
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
// acrescenta ?k=v ANTES do #hash (ex.: /#planos -> /?checkout=success#planos)
function withQuery(p,k,v){const i=p.indexOf('#'),base=i<0?p:p.slice(0,i),hash=i<0?'':p.slice(i);return base+(base.includes('?')?'&':'?')+k+'='+encodeURIComponent(v)+hash}
async function createCheckout({user,kind,amount,promo,course_id,lesson_id,origin,returnPath,consentAt}){
  const meta={app:'worldcourses',consent_at:String(consentAt||''),user_id:String(user.id),kind,course_id:String(course_id||''),lesson_id:String(lesson_id||''),return_path:String(returnPath||'/').slice(0,400),promo_until:promo?String(Math.floor(promo/1000)):''};
  const coupon=kind==='subscription'&&promo?await ensureCoupon(promo):null;
  const s=await stripe.checkout.sessions.create({
    mode:kind==='subscription'?'subscription':'payment',
    line_items:[{price:priceIds[lookupFor(kind,amount)],quantity:1}],
    ...(coupon?{discounts:[{coupon}]}:{}),
    client_reference_id:String(user.id),customer_email:user.email,metadata:meta,
    ...(kind==='subscription'?{subscription_data:{metadata:meta}}:{payment_intent_data:{metadata:meta}}),
    success_url:`${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:origin+withQuery(meta.return_path,'checkout','cancel')});
  return{url:s.url,id:s.id};
}
const iso=ts=>new Date(ts*1000).toISOString().replace('T',' ').slice(0,19);
const exists=ref=>!!db.get('SELECT id FROM payments WHERE provider_ref=?',[ref]);
// Registo idempotente nas tabelas de receita (payments), usadas pelo cálculo de pagamentos a criadores
function recordOneTime(s){
  if(s.payment_status!=='paid'||exists(s.id))return false;const m=s.metadata||{};
  db.run(`INSERT INTO payments(user_id,kind,course_id,lesson_id,amount,provider,provider_ref,status,stripe_customer,consent_at) VALUES(?,?,?,?,?,?,?,?,?,?)`,
    [+m.user_id,m.kind,m.course_id?+m.course_id:null,m.lesson_id?+m.lesson_id:null,s.amount_total/100,'stripe_test',s.id,'paid',typeof s.customer==='string'?s.customer:(s.customer&&s.customer.id)||null,m.consent_at||null]);return true}
function recordInvoice(inv,sub,meta){
  if(inv.status!=='paid'||exists(inv.id))return false;const m=meta||(sub&&sub.metadata)||{};if(!m.user_id)return false;
  const line=inv.lines&&inv.lines.data&&inv.lines.data[0],per=(line&&line.period)||{start:inv.period_start,end:inv.period_end};
  const disc=(inv.total_discount_amounts||[]).some(d=>d.amount>0)||(inv.discounts||[]).length>0;
  db.run(`INSERT INTO payments(user_id,kind,amount,provider,provider_ref,status,starts_at,ends_at,stripe_sub,promo,stripe_customer,consent_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
    [+m.user_id,'subscription',inv.amount_paid/100,'stripe_test',inv.id,'paid',iso(per.start),iso(per.end),(typeof inv.subscription==='string'?inv.subscription:null)||(inv.parent&&inv.parent.subscription_details&&inv.parent.subscription_details.subscription)||(sub&&sub.id)||null,disc?'launch_window':null,typeof inv.customer==='string'?inv.customer:(inv.customer&&inv.customer.id)||null,m.consent_at||null]);return true}
async function fulfillSession(sessionId){
  const s=await stripe.checkout.sessions.retrieve(sessionId,{expand:['invoice','subscription']});
  if(s.livemode||(s.metadata||{}).app!=='worldcourses')return{ok:false};
  if(s.mode==='payment'){recordOneTime(s);return{ok:s.payment_status==='paid',session:s}}
  if(s.mode==='subscription'&&s.invoice){recordInvoice(s.invoice,s.subscription,s.metadata);try{await scheduleLaunchEnd(s.subscription,s.metadata)}catch(e){console.error('schedule:',e.message)}return{ok:s.invoice.status==='paid',session:s}}
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
  else if(ev.type==='customer.subscription.updated'){db.run(`UPDATE payments SET canceled_at=? WHERE stripe_sub=?`,[o.cancel_at_period_end||o.cancel_at?iso(o.canceled_at||Math.floor(Date.now()/1000)):null,o.id])}
  else if(ev.type==='customer.subscription.deleted'){db.run(`UPDATE payments SET canceled_at=COALESCE(canceled_at,datetime('now')) WHERE stripe_sub=?`,[o.id]);db.run(`UPDATE payments SET ends_at=MIN(ends_at,datetime('now')) WHERE stripe_sub=?`,[o.id])}
  return ev.type;
}
// Stripe Customer Portal (teste): configuração própria criada uma vez (cancelamento no fim do período, faturas, cartão)
let portalCfg=null;
async function ensurePortalConfig(){if(portalCfg)return portalCfg;
  for await(const c of stripe.billingPortal.configurations.list({active:true,limit:100}))if((c.metadata||{}).app==='worldcourses'){return portalCfg=c.id}
  const c=await stripe.billingPortal.configurations.create({metadata:{app:'worldcourses'},
    business_profile:{headline:'The World Courses — All Access'},
    features:{subscription_cancel:{enabled:true,mode:'at_period_end',cancellation_reason:{enabled:true,options:['too_expensive','missing_features','unused','other']}},
      payment_method_update:{enabled:true},invoice_history:{enabled:true},customer_update:{enabled:false}}},{idempotencyKey:'wc-portal-cfg-v1'});
  return portalCfg=c.id}
async function customerFor(userId){
  const p=db.get(`SELECT stripe_customer FROM payments WHERE user_id=? AND stripe_customer IS NOT NULL ORDER BY id DESC LIMIT 1`,[userId]);if(p)return p.stripe_customer;
  const q=db.get(`SELECT stripe_sub FROM payments WHERE user_id=? AND stripe_sub IS NOT NULL ORDER BY id DESC LIMIT 1`,[userId]);if(!q)return null;
  const sub=await stripe.subscriptions.retrieve(q.stripe_sub);const cus=typeof sub.customer==='string'?sub.customer:sub.customer.id;
  db.run('UPDATE payments SET stripe_customer=? WHERE stripe_sub=?',[cus,q.stripe_sub]);return cus}
async function portalSession(userId,returnUrl){const customer=await customerFor(userId);if(!customer)return null;
  const s=await stripe.billingPortal.sessions.create({customer,return_url:returnUrl,configuration:await ensurePortalConfig()});return s.url}
async function subStatus(subId){try{const s=await stripe.subscriptions.retrieve(subId);
  if(s.cancel_at_period_end||s.cancel_at||s.status==='canceled')db.run(`UPDATE payments SET canceled_at=COALESCE(canceled_at,datetime('now')) WHERE stripe_sub=?`,[subId]);
  else db.run('UPDATE payments SET canceled_at=NULL WHERE stripe_sub=?',[subId]);
  return{status:s.status,cancel_at_period_end:!!(s.cancel_at_period_end||s.cancel_at),current_period_end:s.current_period_end||(s.items&&s.items.data[0]&&s.items.data[0].current_period_end)||null}}catch(e){return null}}
// Agenda a passagem para €39,99 no fim da janela (fase 2 sem desconto); idempotente
async function scheduleLaunchEnd(sub,meta){
  const until=+((meta||{}).promo_until||0);if(!until||!sub||until*1000<=Date.now())return;
  if(typeof sub==='string')sub=await stripe.subscriptions.retrieve(sub);
  if(sub.schedule)return; // já agendada
  const sch=await stripe.subscriptionSchedules.create({from_subscription:sub.id});
  const ph=sch.phases[0],price=priceIds.wc_sub_3999;
  await stripe.subscriptionSchedules.update(sch.id,{end_behavior:'release',phases:[
    {items:[{price,quantity:1}],start_date:ph.start_date,end_date:until,discounts:ph.discounts&&ph.discounts.length?ph.discounts.map(d=>({coupon:d.coupon||undefined,discount:d.discount||undefined})):[{coupon:couponId(new Date(until*1000))}],proration_behavior:'none'},
    {items:[{price,quantity:1}],discounts:[],proration_behavior:'none',duration:{interval:'month',interval_count:1}}],metadata:{app:'worldcourses',reason:'launch_window_end'}});
}
// Rede de segurança: depois do fim da janela, remove qualquer desconto de lançamento ainda ativo (corre no arranque e de hora a hora)
function startPromoJob(getEnd){if(!stripe)return;const run=async()=>{try{const end=getEnd();if(!end||Date.now()<end)return;
  for await(const sub of stripe.subscriptions.list({status:'active',limit:100})){if((sub.metadata||{}).app!=='worldcourses')continue;
    const ds=sub.discounts||[];const has=ds.length||sub.discount;if(!has)continue;
    const cid=(sub.discount&&sub.discount.coupon&&sub.discount.coupon.id)||'';if(cid&&!cid.startsWith('wc_launch_'))continue;
    if(sub.schedule)continue; // a schedule trata disso
    await stripe.subscriptions.deleteDiscount(sub.id);console.log('promo removida da subscrição',sub.id)}}catch(e){console.error('promo job:',e.message)}};
  setTimeout(run,5000);setInterval(run,36e5).unref()}
async function charge({kind,amount}){ // modo mock
  return{provider:'mock',ref:'mock_'+kind+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),status:'paid',amount};
}
module.exports={withQuery,portalSession,subStatus,PROMO,startPromoJob,PRICES,MODE,setup,createCheckout,fulfillSession,handleWebhook,charge,stripe:()=>stripe};
