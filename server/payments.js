// ===== Pagamentos — APENAS MODO TESTE/MOCK =====
// Estrutura pronta para Stripe. Para ligar ao Stripe em modo de TESTE:
//   1) npm i stripe
//   2) exportar STRIPE_SECRET_KEY=sk_test_xxx  (PLACEHOLDER — nunca usar sk_live_)
//   3) implementar createStripeCheckout() abaixo (Checkout Session) + webhook checkout.session.completed -> markPaid()
// Este servidor RECUSA chaves live: nenhuma cobrança real é possível.
const PRICES={lesson:4.99,course_tiers:[4.99,12.99],subscription:39.99};
const KEY=process.env.STRIPE_SECRET_KEY||'';
if(KEY.startsWith('sk_live_')){console.error('ERRO: chaves Stripe LIVE não são permitidas. Use sk_test_.');process.exit(1)}
const MODE=KEY.startsWith('sk_test_')?'stripe_test':'mock';
async function createStripeCheckout(/*{user,kind,amount,metadata}*/){
  // PLACEHOLDER: const stripe=require('stripe')(KEY);
  // return stripe.checkout.sessions.create({mode:kind==='subscription'?'subscription':'payment',...});
  throw new Error('Stripe test mode not implemented yet — using mock');
}
async function charge({kind,amount}){
  // modo mock: aprova imediatamente e devolve uma referência fictícia
  return{provider:'mock',ref:'mock_'+kind+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),status:'paid',amount};
}
module.exports={PRICES,MODE,charge,createStripeCheckout};
