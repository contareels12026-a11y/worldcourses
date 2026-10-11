const CATS=[['tech','🖥️'],['mech','🚗'],['biz','📈'],['ai','🤖'],['design','🎨'],['health','💓'],['food','👨‍🍳'],['diy','🏠'],['travel','✈️'],['fitness','🏋️'],['influencer','🤳'],['more','⋯']];
let SPK=new URLSearchParams(location.search).get('spoken')||'',COURSES=[],TAB='all',CAT=new URLSearchParams(location.search).get('cat')||'',Q=(new URLSearchParams(location.search).get('q')||'').toLowerCase();
const car=document.getElementById('carousel');
function render(){let list=[...COURSES];
  if(CAT&&CAT!=='more')list=list.filter(c=>c.category===CAT);
  if(SPK)list=list.filter(c=>c.spoken_language===SPK);
  if(Q)list=list.filter(c=>(c.title+' '+c.subtitle+' '+c.creator).toLowerCase().includes(Q));
  if(TAB==='pop')list.sort((a,b)=>b.views-a.views);if(TAB==='new')list.sort((a,b)=>b.id-a.id);if(TAB==='prem')list=list.filter(c=>c.badge==='PREMIUM');
  const cls={PREMIUM:'prem',ESSENTIAL:'ess','ALL ACCESS':'all',FREE:'free'};
  document.getElementById('filterNote').textContent=CAT||Q?`${CAT?t('c_'+CAT).replace('<br>',' '):''} ${Q?'“'+Q+'”':''} · ${list.length}`:'';
  car.innerHTML=list.map(c=>`<a class="card" href="/course.html?id=${c.id}"><div class="thumb"><img src="/${esc(c.image)}" alt=""><span class="badge ${cls[c.badge]||'prem'}">${esc(c.badge)}</span><span class="fav">♡</span><span class="dur">◷ ${fmtDur(c.duration_sec)}</span><span class="thumb-langs">${langBadge(c.spoken_language)}${c.captions?'<span class="cc-dot sm" title="'+t('cc_note')+'">CC</span>':''}</span></div><div class="body"><h3>${esc(c.title)}</h3><p>${esc(c.subtitle)}</p><div class="meta"><span class="au"><img src="/assets/av${(c.creator_id%8)+1}.jpg" alt="">${esc(c.creator)}</span><span class="rt">${c.review_count?`★ ${c.rating} (${c.review_count})`:`<em class="new-t">${t('no_reviews_short')}</em>`}</span></div><div class="price-row">${c.is_free?`<b class="free-t">${t('free')}</b>`:`<b>${eur(c.price)}</b>`}<span>${c.lessons} ${t('lessons')}</span></div></div></a>`).join('')||'<p class="muted">—</p>';car.scrollLeft=0}
READY.then(async()=>{
  document.querySelectorAll('.cats a').forEach(x=>x.classList.toggle('on',x.dataset.cat===CAT));
  document.querySelectorAll('[data-cat]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();document.getElementById('cursos').scrollIntoView({behavior:'smooth'});CAT=a.dataset.cat;document.querySelectorAll('.cats a').forEach(x=>x.classList.toggle('on',x.dataset.cat===CAT));render()}));
  car.innerHTML='<p class="muted">…</p>';COURSES=await api('/api/courses?lang='+LANG);
  const langs=[...new Set(COURSES.map(c=>c.spoken_language).filter(Boolean))];const sel=document.getElementById('spokenFilter');
  sel.innerHTML=`<option value="">🌐 ${t('spoken')}: ${t('all_langs')}</option>`+langs.map(c=>`<option value="${c}" ${c===SPK?'selected':''}>${FLAGS[c]} ${t('lang_'+c)} (${COURSES.filter(x=>x.spoken_language===c).length})</option>`).join('');
  sel.onchange=()=>{SPK=sel.value;render()};render();
  const p=await api('/api/pricing');document.getElementById('subPrice').innerHTML=promoHTML(p);const hb=document.getElementById('promoHero');if(hb&&p.promo){hb.innerHTML=`♛ ALL ACCESS · <s>${eur(p.subscription)}</s> <b>${t('promo_line').replace('{d}',fmtDate(p.promo.until))}</b>`;hb.hidden=false}
  document.getElementById('subscribeBtn').onclick=async e=>{e.preventDefault();if(!ME)return location.href='/login.html?next=/%23planos';
    if(!await checkoutConsent(`All Access — ${p.promo?eur(p.promo.price):eur(p.subscription)}${t('per_month')}`))return;const r=await api('/api/checkout',{method:'POST',body:{consent:true,kind:'subscription',return_path:'/#planos'}});if(r.url){location.href=r.url;return}alert(t('paid_ok'));location.reload()};
});
document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#tabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active');TAB=b.dataset.t;render()});
const step=el=>(el.firstElementChild?.offsetWidth||250)+16;
document.getElementById('prev').onclick=()=>car.scrollBy({left:-step(car),behavior:'smooth'});
document.getElementById('next').onclick=()=>car.scrollBy({left:step(car),behavior:'smooth'});
document.querySelectorAll('.chip').forEach(c=>c.onclick=()=>{document.querySelectorAll('.chip').forEach(x=>x.classList.remove('active'));c.classList.add('active')});
