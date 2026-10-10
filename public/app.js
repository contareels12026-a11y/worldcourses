// Partilhado por todas as páginas: i18n, cabeçalho/rodapé, sessão, tema
const LANGS=['pt','en','fr'];
let LANG=localStorage.getItem('wc-lang')||(new URLSearchParams(location.search).get('lang'))||'pt';
const qLang=new URLSearchParams(location.search).get('lang');if(qLang&&LANGS.includes(qLang))LANG=qLang;
const t=k=>{const v=I18N[k];return v?v[LANGS.indexOf(LANG)]:k};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api=async(url,opt={},tries=0)=>{let r;try{r=await fetch(url,{headers:{'Content-Type':'application/json'},credentials:'same-origin',...opt,body:opt.body?JSON.stringify(opt.body):undefined})}catch(e){if(tries<5){await new Promise(z=>setTimeout(z,1500*(tries+1)));return api(url,opt,tries+1)}throw e}
  if(r.status>=502&&r.status<=504&&tries<5&&(!opt.method||opt.method==='GET')){await new Promise(z=>setTimeout(z,1500*(tries+1)));return api(url,opt,tries+1)}let d=null;try{d=await r.json()}catch{}if(!r.ok){const e=new Error(d&&d.error||r.status);e.status=r.status;e.data=d;throw e}return d};
const eur=v=>new Intl.NumberFormat({pt:'pt-PT',en:'en-IE',fr:'fr-FR'}[LANG],{style:'currency',currency:'EUR'}).format(v||0);
const fmtDur=s=>{const h=Math.floor(s/3600),m=Math.round(s%3600/60);return h?`${h}h ${String(m).padStart(2,'0')}min`:`${m}min`};
let ME=null;
const FLAGS={pt:'🇵🇹',en:'🇬🇧',fr:'🇫🇷',es:'🇪🇸',de:'🇩🇪',it:'🇮🇹',none:'🔇'},SPOKEN=['pt','en','fr','es','de','it'];
const langBadge=(code,cls='')=>code?`<span class="lang-dot ${cls}" title="${t('spoken')}: ${t('lang_'+code)}">${FLAGS[code]||'🌐'} ${code==='none'?t('no_dialogue'):code.toUpperCase()}</span>`:'';
const ccBadge=(cls='')=>`<span class="cc-dot ${cls}" title="${t('cc_note')}">CC ${t('subtitles')}</span>`;
const langOptions=(withNone)=>`<option value="" selected disabled>${t('choose_lang')}</option>`+[...SPOKEN,...(withNone?['none']:[])].map(c=>`<option value="${c}">${FLAGS[c]} ${t('lang_'+c)}</option>`).join('');
const fmtDate=d=>new Date(d+'T00:00:00Z').toLocaleDateString({pt:'pt-PT',en:'en-GB',fr:'fr-FR'}[LANG],{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'});
const promoHTML=p=>p&&p.promo?`<span class="promo-tag">${t('promo_badge')}</span><p class="price"><s class="old">${eur(p.subscription)}</s> ${eur(p.promo.price)} <small>${t('per_month')}</small></p><p class="promo-line">${t('promo_line').replace('{d}',fmtDate(p.promo.until))}</p>`:`<p class="price">${eur(p.subscription)} <small>${t('per_month')}</small></p>`;
function applyI18n(root=document){if(root===document&&document.body.dataset.page){const p=document.body.dataset.page;if(I18N['meta_title_'+p])document.title=t('meta_title_'+p);const md=document.querySelector('meta[name=description]');if(md&&I18N['meta_desc_'+p])md.content=t('meta_desc_'+p)}document.documentElement.lang=LANG==='pt'?'pt-PT':LANG;
  root.querySelectorAll('[data-i18n]').forEach(e=>e.innerHTML=t(e.dataset.i18n));
  root.querySelectorAll('[data-i18n-ph]').forEach(e=>e.placeholder=t(e.dataset.i18nPh));
  root.querySelectorAll('[data-i18n-aria]').forEach(e=>e.setAttribute('aria-label',t(e.dataset.i18nAria)))}
const LOGO=`<a href="/" class="logo"><span class="logo-word"><span class="logo-c">C</span><span class="globe"></span>URSES</span><small>LEARN · GROW · EXPLORE · ANYWHERE</small></a>`;
function renderChrome(){
  const top=document.getElementById('chrome-top');if(top)top.innerHTML=`
<div class="topbar"><div class="wrap"><span data-i18n="topbar"></span><nav><a href="#" data-i18n="help"></a><a href="#footer" data-i18n="contacts"></a>
<select id="langSel" class="lang" aria-label="Idioma / Language / Langue">${[['pt','🇵🇹 Português (PT)'],['en','🇬🇧 English'],['fr','🇫🇷 Français']].map(([v,l])=>`<option value="${v}" ${v===LANG?'selected':''}>${l}</option>`).join('')}</select></nav></div></div>
<header class="header"><div class="wrap">${LOGO}
<nav class="mainnav" id="mainnav"><a href="/#cat" data-i18n="nav_categories"></a><a href="/#cursos" data-i18n="nav_courses"></a><a href="/creator.html" data-i18n="nav_creators"></a><a href="/#planos" data-i18n="nav_plans"></a><a href="#footer" data-i18n="nav_about"></a>
<div class="mobile-only" id="authMobile"></div></nav>
<form class="search" id="searchForm"><input data-i18n-ph="search_ph" id="searchInput"><button data-i18n-aria="search_btn">⌕</button></form>
<div class="theme"><button id="toLight" data-i18n-aria="light">☀</button><button id="toDark" data-i18n-aria="dark">☾</button></div>
<div class="auth" id="authBox"></div>
<button class="burger" id="burger" aria-label="Menu">☰</button></div></header>`;
  const f=document.getElementById('chrome-foot');if(f)f.innerHTML=`
<section class="trust"><div class="wrap"><div><i>📚</i><b data-stat="courses">–</b><span data-i18n="st_courses"></span></div><div><i>🗂️</i><b data-stat="categories">–</b><span data-i18n="st_categories"></span></div><div><i>🎁</i><b data-stat="free_courses">–</b><span data-i18n="tr_free"></span></div><div><i>🧪</i><b data-i18n="tr_test_t"></b><span data-i18n="tr_test"></span></div><div><i>⭐</i><b data-i18n="tr_rev_t"></b><span data-i18n="tr_rev"></span></div></div></section>
<footer id="footer"><div class="wrap foot">${LOGO}
<div><h4 data-i18n="f_platform"></h4><a href="/#cat" data-i18n="nav_categories"></a><a href="/#cursos" data-i18n="nav_courses"></a><a href="/creator.html" data-i18n="nav_creators"></a><a href="/#planos" data-i18n="nav_plans"></a></div>
<div><h4 data-i18n="f_company"></h4><a data-i18n="nav_about"></a><a data-i18n="blog"></a><a data-i18n="careers"></a><a data-i18n="contacts"></a></div>
<div><h4 data-i18n="f_support"></h4><a data-i18n="help"></a><a data-i18n="terms"></a><a data-i18n="privacy"></a><a data-i18n="cookies"></a></div>
<div><h4 data-i18n="f_follow"></h4><div class="socials"><a aria-label="Instagram">◎</a><a aria-label="YouTube">▶</a><a aria-label="LinkedIn">in</a><a aria-label="X">𝕏</a><a aria-label="Facebook">f</a><a aria-label="TikTok">♪</a></div></div>
<div><h4 data-i18n="f_news"></h4><form class="news" id="newsForm"><input type="email" required data-i18n-ph="email_ph"><button>→</button></form></div></div>
<div class="wrap copy"><span data-i18n="rights"></span><span>Learn. Grow. Explore. Anywhere. <a href="#" class="up">↑</a></span></div></footer>`;
  applyI18n();renderAuth();loadStats();
  const sel=document.getElementById('langSel');sel&&(sel.onchange=()=>{localStorage.setItem('wc-lang',sel.value);const u=new URL(location);u.searchParams.delete('lang');location.href=u});
  const root=document.documentElement;
  document.getElementById('toLight')?.addEventListener('click',()=>{root.dataset.theme='light';localStorage.setItem('wc-theme','light')});
  document.getElementById('toDark')?.addEventListener('click',()=>{root.dataset.theme='dark';localStorage.setItem('wc-theme','dark')});
  document.getElementById('burger')?.addEventListener('click',()=>document.getElementById('mainnav').classList.toggle('open'));
  document.querySelector('.up')?.addEventListener('click',e=>{e.preventDefault();scrollTo({top:0,behavior:'smooth'})});
  document.getElementById('newsForm')?.addEventListener('submit',e=>{e.preventDefault();e.target.reset();alert(t('news_ok'))});
  document.getElementById('searchForm')?.addEventListener('submit',e=>{e.preventDefault();location.href='/?q='+encodeURIComponent(document.getElementById('searchInput').value)+'#cursos'});
}
async function loadStats(){if(!document.querySelector('[data-stat]'))return;try{const s=await api('/api/stats');document.querySelectorAll('[data-stat]').forEach(e=>e.textContent=s[e.dataset.stat])}catch{}}
function renderAuth(){const html=ME?`${ME.role==='creator'?`<a href="/creator.html" class="entrar" data-i18n="dashboard"></a>`:''}${ME.role==='admin'?`<a href="/admin.html" class="entrar" data-i18n="admin"></a>`:''}<span class="who">👤 ${esc(ME.name)}${ME.subscription_until?' <em class="pill">ALL ACCESS</em>':''}</span><a href="#" class="btn ghost sm" id="logoutBtn" data-i18n="logout"></a>`
  :`<a href="/login.html" class="entrar" data-i18n="login"></a><a href="/login.html?mode=signup" class="btn gold sm" data-i18n="signup"></a>`;
  for(const id of['authBox','authMobile']){const el=document.getElementById(id);if(el){el.innerHTML=html;applyI18n(el)}}
  document.querySelectorAll('#logoutBtn').forEach(b=>b.onclick=async e=>{e.preventDefault();await api('/api/logout',{method:'POST'});location.href='/'})}
(function(){const s=localStorage.getItem('wc-theme');if(s)document.documentElement.dataset.theme=s})();
addEventListener('load',()=>{const c=new URLSearchParams(location.search).get('checkout');if(c){const m={success:'paid_ok',cancel:'checkout_cancel',pending:'checkout_pending',error:'checkout_error'}[c];if(m)setTimeout(()=>alert(t(m)),300);const u=new URL(location);u.searchParams.delete('checkout');history.replaceState(null,'',u)}});
const READY=(async()=>{if(document.readyState==="loading")await new Promise(r=>document.addEventListener("DOMContentLoaded",r));try{ME=await api('/api/me')}catch{}renderChrome();return ME})();
