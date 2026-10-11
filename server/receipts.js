// Recibo por email 3 dias após cada pagamento Stripe bem-sucedido.
// Desativado se SMTP_HOST/SMTP_USER/SMTP_PASS/SMTP_FROM não estiverem definidos. Pagamentos anteriores a esta funcionalidade
// estão marcados 'legacy' e nunca recebem email. A fatura-recibo legal é emitida separadamente (Portal das Finanças).
const db=require('./db');
const SELLER={name:'Miguel Sequeira (trabalhador independente)',addr:'Sítio do Sobral, Ap. 53P, 8400-491 Porches, Portugal',nif:'260272167',email:'contareels12026@gmail.com'};
const DELAY_DAYS=+(process.env.RECEIPT_DELAY_DAYS||3);
const enabled=()=>['SMTP_HOST','SMTP_USER','SMTP_PASS','SMTP_FROM'].every(k=>process.env[k]);
const eur=n=>Number(n).toFixed(2).replace('.',',')+' €';
const title=j=>{try{const x=JSON.parse(j);return(x.pt||x.en).title}catch{return''}};
function item(p){if(p.kind==='subscription')return{pt:`Subscrição All Access (mensal)${p.starts_at?` — período ${p.starts_at.slice(0,10)} a ${String(p.ends_at||'').slice(0,10)}`:''}`,en:'All Access subscription (monthly)'};
  if(p.kind==='course')return{pt:`Curso: ${title(p.course_i18n)}`,en:`Course: ${title(p.course_i18n)}`};return{pt:`Aula: ${title(p.lesson_i18n)}`,en:`Lesson: ${title(p.lesson_i18n)}`}}
function compose(p){const it=item(p),d=p.created_at.slice(0,10);
  const subject=`Recibo / Receipt — The World Courses — ${d}`;
  const text=`Olá ${p.user_name||''},

Obrigado pela tua compra na The World Courses. Resumo do pagamento:

Vendedor: ${SELLER.name}
Morada: ${SELLER.addr}
NIF: ${SELLER.nif}
Contacto: ${SELLER.email}

Artigo: ${it.pt}
Valor pago: ${eur(p.amount)} (IVA incluído quando aplicável)
Data do pagamento: ${d}
Referência do pagamento: ${p.provider_ref}

Fatura-recibo emitida separadamente.

Este email é um resumo do pagamento e não substitui a fatura-recibo.

---
Payment summary (EN): ${it.en} — ${eur(p.amount)} — ${d} — ref. ${p.provider_ref}. Seller: ${SELLER.name}, ${SELLER.addr}, NIF ${SELLER.nif}. The invoice-receipt (fatura-recibo) is issued separately.

The World Courses
`;
  const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const html=`<div style="font-family:Arial,sans-serif;max-width:560px;color:#222">${text.split('\n\n').map(b=>`<p>${esc(b).replace(/\n/g,'<br>')}</p>`).join('')}</div>`;
  return{subject,text,html}}
function due(){return db.all(`SELECT p.*,u.email user_email,u.name user_name,c.i18n course_i18n,l.i18n lesson_i18n FROM payments p JOIN users u ON u.id=p.user_id
  LEFT JOIN courses c ON c.id=p.course_id LEFT JOIN lessons l ON l.id=p.lesson_id
  WHERE p.status='paid' AND p.provider LIKE 'stripe%' AND p.receipt_sent_at IS NULL AND p.amount>0 AND p.created_at<=datetime('now',?) ORDER BY p.id LIMIT 50`,[`-${DELAY_DAYS} days`])}
let transport=null;
async function runOnce(){if(!enabled())return 0;
  if(!transport){const nm=require('nodemailer');transport=nm.createTransport({host:process.env.SMTP_HOST,port:+(process.env.SMTP_PORT||587),secure:(process.env.SMTP_PORT||'587')==='465',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}})}
  let n=0;for(const p of due()){const m=compose(p);
    try{await transport.sendMail({from:process.env.SMTP_FROM,to:p.user_email,replyTo:SELLER.email,...m});db.run(`UPDATE payments SET receipt_sent_at=datetime('now') WHERE id=?`,[p.id]);n++}
    catch(e){console.error('recibo',p.id,e.message)}}
  if(n)console.log('recibos enviados:',n);return n}
function start(){if(!enabled()){console.log('Recibos por email: desativados (SMTP_* não definido)');return}
  console.log(`Recibos por email: ativos (${DELAY_DAYS} dias após pagamento)`);const go=()=>runOnce().catch(e=>console.error('recibos:',e.message));setTimeout(go,30e3);setInterval(go,60*60e3)}
module.exports={start,runOnce,compose,due,enabled};
