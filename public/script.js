const CATS=[['tech','🖥️'],['mech','🚗'],['biz','📈'],['ai','🤖'],['design','🎨'],['health','💓'],['food','👨‍🍳'],['diy','🏠'],['travel','✈️'],['fitness','🏋️'],['more','⋯']];
let COURSES=[],TAB='all',CAT=new URLSearchParams(location.search).get('cat')||'',Q=(new URLSearchParams(location.search).get('q')||'').toLowerCase();
const car=document.getElementById('carousel');
function render(){let list=[...COURSES];
  if(CAT&&CAT!=='more')list=list.filter(c=>c.category===CAT);
  if(Q)list=list.filter(c=>(c.title+' '+c.subtitle+' '+c.creator).toLowerCase().includes(Q));
  if(TAB==='pop')list.sort((a,b)=>b.views-a.views);if(TAB==='new')list.sort((a,b)=>b.id-a.id);if(TAB==='prem')list=list.filter(c=>c.badge==='PREMIUM');
  const cls={PREMIUM:'prem',ESSENTIAL:'ess','ALL ACCESS':'all',FREE:'free'};
  document.getElementById('filterNote').textContent=CAT||Q?`${CAT?t('c_'+CAT).replace('<br>',' '):''} ${Q?'“'+Q+'”':''} · ${list.length}`:'';
  car.innerHTML=list.map(c=>`<a class="card" href="/course.html?id=${c.id}"><div class="thumb"><img src="/${esc(c.image)}" alt=""><span class="badge ${cls[c.badge]||'prem'}">${esc(c.badge)}</span><span class="fav">♡</span><span class="dur">◷ ${fmtDur(c.duration_sec)}</span></div><div class="body"><h3>${esc(c.title)}</h3><p>${esc(c.subtitle)}</p><div class="meta"><span class="au"><img src="/assets/av${(c.creator_id%8)+1}.jpg" alt="">${esc(c.creator)}</span><span class="rt">★ ${c.rating} (${c.views})</span></div><div class="price-row">${c.is_free?`<b class="free-t">${t('free')}</b>`:`<b>${eur(c.price)}</b>`}<span>${c.lessons} ${t('lessons')}</span></div></div></a>`).join('')||'<p class="muted">—</p>';car.scrollLeft=0}
READY.then(async()=>{
  document.getElementById('cats').innerHTML=CATS.map(([k,i])=>`<a href="#cursos" data-cat="${k}" class="${k===CAT?'on':''}"><i>${i}</i><span data-i18n="c_${k}"></span></a>`).join('');applyI18n(document.getElementById('cats'));
  document.querySelectorAll('[data-cat]').forEach(a=>a.addEventListener('click',()=>{CAT=a.dataset.cat;document.querySelectorAll('.cats a').forEach(x=>x.classList.toggle('on',x.dataset.cat===CAT));render()}));
  COURSES=await api('/api/courses?lang='+LANG);render();
  const p=await api('/api/pricing');document.getElementById('subPrice').innerHTML=`${eur(p.subscription)} <small>${t('per_month')}</small>`;
  document.getElementById('subscribeBtn').onclick=async e=>{e.preventDefault();if(!ME)return location.href='/login.html?next=/%23planos';
    if(!confirm(`${t('confirm_pay')} ${eur(p.subscription)}?\n${t('test_mode')}`))return;await api('/api/checkout',{method:'POST',body:{kind:'subscription'}});alert(t('paid_ok'));location.reload()};
});
document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#tabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active');TAB=b.dataset.t;render()});
const step=el=>(el.firstElementChild?.offsetWidth||250)+16;
document.getElementById('prev').onclick=()=>car.scrollBy({left:-step(car),behavior:'smooth'});
document.getElementById('next').onclick=()=>car.scrollBy({left:step(car),behavior:'smooth'});
const ts=document.getElementById('testis');
document.getElementById('tprev').onclick=()=>ts.scrollBy({left:-step(ts),behavior:'smooth'});
document.getElementById('tnext').onclick=()=>ts.scrollBy({left:step(ts),behavior:'smooth'});
document.querySelectorAll('.chip').forEach(c=>c.onclick=()=>{document.querySelectorAll('.chip').forEach(x=>x.classList.remove('active'));c.classList.add('active')});
