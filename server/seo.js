// SEO: meta título/descrição por idioma, Open Graph, hreflang, canonical, robots.txt, sitemap.xml
const fs=require('fs'),path=require('path'),db=require('./db');
const PUB=path.join(__dirname,'..','public');
const BASE=(process.env.PUBLIC_URL||'https://worldcourses.onrender.com').replace(/\/$/,'');
const LANGS=['pt','en','fr'],LOC={pt:'pt_PT',en:'en_GB',fr:'fr_FR'};
const M={
 home:{t:['The World Courses — Conhecimento para um mundo melhor','The World Courses — Knowledge for a better world','The World Courses — Le savoir pour un monde meilleur'],
  d:['Cursos online em todas as áreas: tecnologia, IA, negócios, saúde, culinária e mais. Aprende ao teu ritmo com os melhores criadores.','Online courses in every field: tech, AI, business, health, cooking and more. Learn at your own pace with the best creators.','Des cours en ligne dans tous les domaines : tech, IA, business, santé, cuisine et plus. Apprends à ton rythme avec les meilleurs créateurs.']},
 login:{t:['Entrar — The World Courses','Log in — The World Courses','Connexion — The World Courses'],d:['Entra ou cria a tua conta de aluno ou criador.','Log in or create your student or creator account.','Connecte-toi ou crée ton compte élève ou créateur.']},
 creator:{t:['Painel de Criador — The World Courses','Creator dashboard — The World Courses','Tableau de bord créateur — The World Courses'],d:['Publica cursos e acompanha visualizações e ganhos.','Publish courses and track views and earnings.','Publie des cours et suis tes vues et gains.'],noindex:1},
 admin:{t:['Administração — The World Courses','Admin — The World Courses','Administration — The World Courses'],d:['Administração da plataforma.','Platform administration.','Administration de la plateforme.'],noindex:1},
};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const cache={};const file=f=>cache[f]||(cache[f]=fs.readFileSync(path.join(PUB,f),'utf8'));
function page(name,file_){return(req,res,next)=>{
  const lang=LANGS.includes(req.query.lang)?req.query.lang:'pt',i=LANGS.indexOf(lang);
  let title,desc,img=BASE+'/assets/og.jpg',noindex=false,pathQ=req.path==='/index.html'?'/':req.path;
  if(name==='course'){const c=db.get('SELECT * FROM courses WHERE id=?',[+req.query.id||0]);if(!c)return next();
    const x=JSON.parse(c.i18n);const tr=x[lang]||x.pt;title=`${tr.title} — The World Courses`;desc=tr.description||tr.subtitle;img=BASE+'/'+c.image;pathQ=`/course.html?id=${c.id}`}
  else{const m=M[name];title=m.t[i];desc=m.d[i];noindex=!!m.noindex}
  const url=l=>BASE+pathQ+(pathQ.includes('?')?'&':'?')+'lang='+l;
  const head=`<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">${noindex?'\n<meta name="robots" content="noindex">':''}
<link rel="canonical" href="${url(lang)}">
${LANGS.map(l=>`<link rel="alternate" hreflang="${l}" href="${url(l)}">`).join('')}<link rel="alternate" hreflang="x-default" href="${url('pt')}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="icon" href="/favicon.ico" sizes="32x32"><meta name="theme-color" content="#07090f">
<meta property="og:type" content="website"><meta property="og:site_name" content="The World Courses"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url(lang)}"><meta property="og:image" content="${esc(img)}"><meta property="og:locale" content="${LOC[lang]}">${LANGS.filter(l=>l!==lang).map(l=>`<meta property="og:locale:alternate" content="${LOC[l]}">`).join('')}
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(img)}">`;
  const html=file(file_).replace(/<title>.*?<\/title>/,head).replace('<html lang="pt"',`<html lang="${lang==='pt'?'pt-PT':lang}"`);
  res.set('Cache-Control','no-cache').type('html').send(html)}}
function mount(app){
  app.get(['/','/index.html'],page('home','index.html'));
  app.get('/course.html',page('course','course.html'));
  app.get('/login.html',page('login','login.html'));
  app.get('/creator.html',page('creator','creator.html'));
  app.get('/admin.html',page('admin','admin.html'));
  app.get('/robots.txt',(req,res)=>res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin.html\nDisallow: /creator.html\n\nSitemap: ${BASE}/sitemap.xml\n`));
  app.get('/sitemap.xml',(req,res)=>{const paths=['/','/login.html',...db.all('SELECT id FROM courses WHERE published=1 ORDER BY id').map(c=>`/course.html?id=${c.id}`)];
    const u=(p,l)=>esc(BASE+p+(p.includes('?')?'&':'?')+'lang='+l);
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n`+
      paths.flatMap(p=>LANGS.map(l=>`<url><loc>${u(p,l)}</loc>${LANGS.map(a=>`<xhtml:link rel="alternate" hreflang="${a}" href="${u(p,a)}"/>`).join('')}<changefreq>weekly</changefreq><priority>${p==='/'?'1.0':'0.7'}</priority></url>`)).join('\n')+'\n</urlset>\n')});
}
module.exports={mount};
