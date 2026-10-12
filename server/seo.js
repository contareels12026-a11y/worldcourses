// SEO: meta título/descrição por idioma, Open Graph, hreflang, canonical, robots.txt, sitemap.xml
const fs=require('fs'),path=require('path'),vm=require('vm'),db=require('./db');
const PUB=path.join(__dirname,'..','public');
const BASE=(process.env.PUBLIC_URL||'https://worldcourses.onrender.com').replace(/\/$/,'');
const LANGS=['pt','en','fr'],LOC={pt:'pt_PT',en:'en_GB',fr:'fr_FR'};
const M={
 home:{t:['The World Courses — Conhecimento para um mundo melhor','The World Courses — Knowledge for a better world','The World Courses — Le savoir pour un monde meilleur'],
  d:['Cursos online em todas as áreas: tecnologia, IA, negócios, saúde, culinária e mais. Aprende ao teu ritmo com cursos grátis e pré-visualizações.','Online courses in every field: tech, AI, business, health, cooking and more. Learn at your own pace with free courses and previews.','Des cours en ligne dans tous les domaines : tech, IA, business, santé, cuisine et plus. Apprends à ton rythme avec des cours gratuits et des aperçus.']},
 login:{t:['Entrar — The World Courses','Log in — The World Courses','Connexion — The World Courses'],d:['Entra ou cria a tua conta de aluno ou criador.','Log in or create your student or creator account.','Connecte-toi ou crée ton compte élève ou créateur.']},
 creator:{t:['Painel de Criador — The World Courses','Creator dashboard — The World Courses','Tableau de bord créateur — The World Courses'],d:['Publica cursos e acompanha visualizações e ganhos.','Publish courses and track views and earnings.','Publie des cours et suis tes vues et gains.'],noindex:1},
 account:{t:['A minha conta — The World Courses','My account — The World Courses','Mon compte — The World Courses'],d:['Subscrição, compras e cancelamento.','Subscription, purchases and cancellation.','Abonnement, achats et résiliation.'],noindex:1},
 info_faq:{t:['Perguntas frequentes — The World Courses','FAQ — The World Courses','FAQ — The World Courses'],d:['Acesso, preços, idiomas e legendas, pagamentos a criadores e Stripe.','Access, pricing, languages and subtitles, creator payouts and Stripe.','Accès, prix, langues et sous-titres, rémunération des créateurs et Stripe.']},
 info_terms:{t:['Termos de Utilização — The World Courses','Terms of Use — The World Courses','Conditions d’utilisation — The World Courses'],d:['Termos de utilização da plataforma.','Platform terms of use.','Conditions d’utilisation de la plateforme.']},
 info_privacy:{t:['Política de Privacidade — The World Courses','Privacy Policy — The World Courses','Politique de confidentialité — The World Courses'],d:['RGPD, dados tratados, Stripe e cookies.','GDPR, data processed, Stripe and cookies.','RGPD, données traitées, Stripe et cookies.']},
 info_refunds:{t:['Reembolsos e Cancelamento — The World Courses','Refunds & Cancellation — The World Courses','Remboursements et résiliation — The World Courses'],d:['Direito de livre resolução de 14 dias, conteúdo digital e cancelamento.','14-day right of withdrawal, digital content and cancellation.','Droit de rétractation de 14 jours, contenu numérique et résiliation.']},
 info_creators:{t:['Termos de Criador — The World Courses','Creator Terms — The World Courses','Conditions créateurs — The World Courses'],d:['Fórmula de pagamento, quota da plataforma, licença e conteúdo proibido.','Payout formula, platform share, licensing and prohibited content.','Formule de rémunération, part de la plateforme, licence et contenus interdits.']},
 admin:{t:['Administração — The World Courses','Admin — The World Courses','Administration — The World Courses'],d:['Administração da plataforma.','Platform administration.','Administration de la plateforme.'],noindex:1},
};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const cache={};const file=f=>cache[f]||(cache[f]=fs.readFileSync(path.join(PUB,f),'utf8'));
const INFO=['faq','terms','privacy','refunds','creators'];
// dicionário partilhado com o cliente (public/i18n.js) para pré-renderizar textos data-i18n no servidor
let I18N={};try{const sb={window:{}};vm.runInNewContext(fs.readFileSync(path.join(PUB,'i18n.js'),'utf8'),sb);I18N=sb.window.I18N||{}}catch(e){console.error('seo i18n:',e.message)}
const tr_=(k,i)=>I18N[k]?(I18N[k][i]??I18N[k][0]):null;
const clip=(s,n=160)=>{s=String(s||'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1).replace(/\s+\S*$/,'')+'…':s};
const CAT_KEY=c=>'c_'+c;
const ld=o=>`<script type="application/ld+json">${JSON.stringify(o).replace(/</g,'\\u003c')}</script>`;
// preenche elementos vazios com data-i18n (o cliente volta a aplicar o mesmo texto); bots veem h1/h2 reais
function prerender(html,i){return html.replace(/(<(\w+)\b[^>]*\sdata-i18n="(\w+)"[^>]*>)(<\/\2>)/g,(m,open,tag,k,close)=>{const v=tr_(k,i);return v==null?m:open+v+close})}
function page(name,file_){return(req,res,next)=>{
  const lang=LANGS.includes(req.query.lang)?req.query.lang:'pt',i=LANGS.indexOf(lang);
  let body=null,main=null,extra='',ogType='website',imgAlt='The World Courses',title,desc,img=BASE+'/assets/og.jpg',noindex=false,pathQ=req.path==='/index.html'?'/':req.path;
  if(name==='course'){const c=db.get('SELECT * FROM courses WHERE id=?',[+req.query.id||0]);if(!c)return next();
    const x=JSON.parse(c.i18n);const tr=x[lang]||x.pt;title=`${tr.title} — The World Courses`;desc=tr.description||tr.subtitle;img=BASE+'/'+c.image;imgAlt=tr.title;pathQ=`/course.html?id=${c.id}`;ogType='article';
    const cat=(tr_(CAT_KEY(c.category),i)||c.category).replace(/<br>/g,' '),u=db.get('SELECT name FROM users WHERE id=?',[c.creator_id]);
    main=`<a href="/#cursos" class="link">← ${esc(tr_('back',i)||'')}</a> · <a href="/?cat=${encodeURIComponent(c.category)}#cursos" class="link">${esc(cat)}</a>
<div class="course-head"><div><h1>${esc(tr.title)}</h1><p class="lead2">${esc(tr.description||tr.subtitle||'')}</p>${u?`<p class="muted">${esc(tr_('by',i)||'')} <b>${esc(u.name)}</b></p>`:''}</div></div>
<div class="course-grid"><div><div class="player"><div class="placeholder"><img src="/${esc(c.image)}" alt="${esc(tr.title)}" width="640" height="360"></div></div></div></div>`;
    extra=ld({'@context':'https://schema.org','@type':'Course',name:tr.title,description:clip(desc,300),url:BASE+pathQ+'&lang='+lang,image:img,inLanguage:c.spoken_language||undefined,isAccessibleForFree:!!c.is_free,
      provider:{'@type':'Organization',name:'The World Courses',url:BASE+'/'},...(u?{creator:{'@type':'Person',name:u.name}}:{})})}
  else if(name==='info'){const p=INFO.includes(req.query.p)?req.query.p:null;if(!p)return next();const m=M['info_'+p];title=m.t[i];desc=m.d[i];pathQ=`/info.html?p=${p}`;
    body=fs.readFileSync(path.join(PUB,'content',`${p}.${lang}.html`),'utf8')}
  else{const m=M[name];title=m.t[i];desc=m.d[i];noindex=!!m.noindex;
    if(name==='home')extra=ld({'@context':'https://schema.org','@graph':[{'@type':'Organization','@id':BASE+'/#org',name:'The World Courses',url:BASE+'/',logo:BASE+'/favicon.svg'},{'@type':'WebSite',name:'The World Courses',url:BASE+'/',inLanguage:['pt-PT','en','fr'],publisher:{'@id':BASE+'/#org'},potentialAction:{'@type':'SearchAction',target:BASE+'/?q={search_term_string}#cursos','query-input':'required name=search_term_string'}}]})}
  desc=clip(desc);
  const url=l=>BASE+pathQ+(pathQ.includes('?')?'&':'?')+'lang='+l;
  const head=`<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">${noindex?'\n<meta name="robots" content="noindex">':''}
<link rel="canonical" href="${url(lang)}">
${LANGS.map(l=>`<link rel="alternate" hreflang="${l}" href="${url(l)}">`).join('')}<link rel="alternate" hreflang="x-default" href="${url('pt')}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="icon" href="/favicon.ico" sizes="32x32"><meta name="theme-color" content="#07090f">
<meta property="og:type" content="${ogType}"><meta property="og:site_name" content="The World Courses"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url(lang)}"><meta property="og:image" content="${esc(img)}"><meta property="og:image:alt" content="${esc(imgAlt)}"><meta property="og:locale" content="${LOC[lang]}">${LANGS.filter(l=>l!==lang).map(l=>`<meta property="og:locale:alternate" content="${LOC[l]}">`).join('')}
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(img)}"><meta name="twitter:image:alt" content="${esc(imgAlt)}">${extra}`;
  let html0=file(file_);if(body!==null)html0=html0.replace('<article id="infoBody" class="legal"></article>',()=>`<article id="infoBody" class="legal">${body}</article>`);
  if(main!==null)html0=html0.replace('<main class="wrap page" id="course"><p class="muted">…</p></main>',()=>`<main class="wrap page" id="course">${main}</main>`);
  html0=prerender(html0,i);
  const html=html0.replace(/<title>.*?<\/title>/,head).replace('<html lang="pt"',`<html lang="${lang==='pt'?'pt-PT':lang}"`);
  res.set('Cache-Control','no-cache').type('html').send(html)}}
function mount(app){
  app.get(['/','/index.html'],page('home','index.html'));
  app.get('/course.html',page('course','course.html'));
  app.get('/login.html',page('login','login.html'));
  app.get('/creator.html',page('creator','creator.html'));
  app.get('/info.html',page('info','info.html'));
  app.get('/account.html',page('account','account.html'));
  app.get('/admin.html',page('admin','admin.html'));
  app.get('/robots.txt',(req,res)=>res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin.html\nDisallow: /creator.html\nDisallow: /account.html\n\nSitemap: ${BASE}/sitemap.xml\n`));
  app.get('/sitemap.xml',(req,res)=>{const paths=['/','/login.html',...INFO.map(p=>`/info.html?p=${p}`),...db.all('SELECT id FROM courses WHERE published=1 ORDER BY id').map(c=>`/course.html?id=${c.id}`)];
    const u=(p,l)=>esc(BASE+p+(p.includes('?')?'&':'?')+'lang='+l);
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n`+
      paths.flatMap(p=>LANGS.map(l=>`<url><loc>${u(p,l)}</loc>${LANGS.map(a=>`<xhtml:link rel="alternate" hreflang="${a}" href="${u(p,a)}"/>`).join('')}<changefreq>weekly</changefreq><priority>${p==='/'?'1.0':'0.7'}</priority></url>`)).join('\n')+'\n</urlset>\n')});
}
module.exports={mount};
