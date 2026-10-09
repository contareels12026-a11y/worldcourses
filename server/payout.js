// Cálculo de pagamentos a criadores — ver README.md, secção "Fórmula de pagamento"
const db=require('./db');
function viewWeight(pct,s){
  if(pct<s.min_pct)return 0;                       // < 10% ignorado
  if(pct>=s.complete_threshold)return s.w_complete; // visualização completa
  return pct*s.partial_factor*s.w_complete;        // parcial: proporcional
}
function period(month){ // 'YYYY-MM'
  const m=month||new Date().toISOString().slice(0,7);
  const [y,mo]=m.split('-').map(Number);
  const end=new Date(Date.UTC(y,mo,1)).toISOString().slice(0,10);
  return{month:m,start:`${m}-01`,end};
}
function compute(month){
  const s=db.settings(),p=period(month);
  const revRows=db.all(`SELECT kind,SUM(amount) total,COUNT(*) n FROM payments WHERE status='paid' AND created_at>=? AND created_at<? GROUP BY kind`,[p.start,p.end]);
  const revenue={lesson:0,course:0,subscription:0};for(const r of revRows)revenue[r.kind]=r.total;
  const gross=revenue.lesson+revenue.course+revenue.subscription;
  const pool=gross*(1-s.platform_share);
  // anti-abuso: o criador a ver os próprios vídeos não conta; 1 visualização contável por utilizador+aula+dia (a de maior %)
  const rows=db.all(`SELECT v.creator_id,v.user_id,v.lesson_id,date(v.created_at) d,MAX(v.pct) pct,MAX(v.seconds) secs
     FROM views v WHERE v.created_at>=? AND v.created_at<? AND v.user_id<>v.creator_id GROUP BY v.creator_id,v.user_id,v.lesson_id,d`,[p.start,p.end]);
  const by={};let totalW=0;
  for(const r of rows){
    const c=by[r.creator_id]||(by[r.creator_id]={creator_id:r.creator_id,views:0,completions:0,partial:0,ignored:0,watch_minutes:0,weight:0});
    const w=viewWeight(r.pct,s);
    c.views++;c.watch_minutes+=r.secs/60;c.weight+=w;totalW+=w;
    if(w===0)c.ignored++;else if(r.pct>=s.complete_threshold)c.completions++;else c.partial++;
  }
  const creators=db.all(`SELECT id,name,email FROM users WHERE role='creator'`);
  const table=creators.map(u=>{const c=by[u.id]||{views:0,completions:0,partial:0,ignored:0,watch_minutes:0,weight:0};
    const share=totalW?c.weight/totalW:0;
    return{...c,creator_id:u.id,name:u.name,email:u.email,share,earnings:Math.round(pool*share*100)/100,watch_minutes:Math.round(c.watch_minutes*10)/10,weight:Math.round(c.weight*1000)/1000}}).sort((a,b)=>b.earnings-a.earnings);
  return{period:p,settings:s,revenue,gross:Math.round(gross*100)/100,platform:Math.round(gross*s.platform_share*100)/100,pool:Math.round(pool*100)/100,total_weight:Math.round(totalW*1000)/1000,table};
}
module.exports={compute,viewWeight};
