// Repõe a base de dados com dados de demonstração. Uso: npm run seed
const fs=require('fs'),bcrypt=require('bcryptjs'),db=require('./db');
const T=(pt,en,fr)=>JSON.stringify({pt,en,fr});
const C=(pt,en,fr)=>JSON.stringify({pt:{title:pt[0],subtitle:pt[1],description:pt[2]},en:{title:en[0],subtitle:en[1],description:en[2]},fr:{title:fr[0],subtitle:fr[1],description:fr[2]}});
(async()=>{
if(fs.existsSync(db.FILE))fs.unlinkSync(db.FILE);
await db.init();
const H=p=>bcrypt.hashSync(p,10);
const admin=db.run('INSERT INTO users(email,name,pass,role) VALUES(?,?,?,?)',['admin@worldcourses.test','Admin','' +H('Admin123!'),'admin']);
const mariana=db.run('INSERT INTO users(email,name,pass,role) VALUES(?,?,?,?)',['mariana@worldcourses.test','Mariana Costa',H('Criador123!'),'creator']);
const ricardo=db.run('INSERT INTO users(email,name,pass,role) VALUES(?,?,?,?)',['ricardo@worldcourses.test','Ricardo Almeida',H('Criador123!'),'creator']);
const aluno=db.run('INSERT INTO users(email,name,pass,role) VALUES(?,?,?,?)',['aluno@worldcourses.test','Sofia Martins',H('Aluno123!'),'user']);
const SRC=a=>`Vídeos: ${a} (YouTube, incorporação pública). Créditos aos autores originais.`;
const courses=[
 {cr:mariana,cat:'tech',img:'img2.jpg',price:0,free:1,src:SRC('freeCodeCamp.org (CC BY-SA) · Programming with Mosh'),
  t:C(['Python para Iniciantes','Aprende a programar do zero','Curso completo e gratuito de Python: variáveis, funções, listas, ciclos e um primeiro projeto.'],['Python for Beginners','Learn to code from scratch','Free complete Python course: variables, functions, lists, loops and a first project.'],['Python pour débutants','Apprends à coder de zéro','Cours complet et gratuit de Python : variables, fonctions, listes, boucles et un premier projet.']),
  L:[[['Introdução e instalação','Introduction & setup','Introduction et installation'],'rfscVS0vtbw',0,1200,1],[['Variáveis e tipos de dados','Variables & data types','Variables et types de données'],'rfscVS0vtbw',1200,1500,0],[['Funções e condições','Functions & conditions','Fonctions et conditions'],'rfscVS0vtbw',4200,1800,0],[['Python em 1 hora (revisão)','Python in 1 hour (review)','Python en 1 heure (révision)'],'kqtD5dpn9C8',0,3600,0]]},
 {cr:mariana,cat:'tech',img:'img9.jpg',price:12.99,badge:'PREMIUM',src:SRC('freeCodeCamp.org · Traversy Media'),
  t:C(['Desenvolvimento Web: HTML & CSS','Constrói o teu primeiro website','Da estrutura HTML ao design responsivo com CSS moderno.'],['Web Development: HTML & CSS','Build your first website','From HTML structure to responsive design with modern CSS.'],['Développement Web : HTML & CSS','Crée ton premier site web','De la structure HTML au design responsive avec le CSS moderne.']),
  L:[[['Fundamentos de HTML','HTML fundamentals','Les bases du HTML'],'pQN-pnXPaVg',0,1500,1],[['Formulários e semântica','Forms & semantics','Formulaires et sémantique'],'pQN-pnXPaVg',3600,1500,0],[['CSS: crash course','CSS crash course','CSS : cours accéléré'],'yfoY53QXEnI',0,4200,0],[['CSS: do zero a herói','CSS: zero to hero','CSS : de zéro à héros'],'1Rs2ND1ryYc',0,2400,0]]},
 {cr:mariana,cat:'tech',img:'img5.jpg',price:12.99,badge:'ALL ACCESS',src:SRC('freeCodeCamp.org · Programming with Mosh · Traversy Media'),
  t:C(['JavaScript & React','Do básico às interfaces modernas','JavaScript essencial e criação de interfaces com React.'],['JavaScript & React','From basics to modern UIs','Essential JavaScript and building interfaces with React.'],['JavaScript & React','Des bases aux interfaces modernes','JavaScript essentiel et création d’interfaces avec React.']),
  L:[[['JavaScript: primeiros passos','JavaScript: first steps','JavaScript : premiers pas'],'PkZNo7MFNFg',0,1800,1],[['Arrays, objetos e ciclos','Arrays, objects & loops','Tableaux, objets et boucles'],'PkZNo7MFNFg',3600,1800,0],[['React para iniciantes','React for beginners','React pour débutants'],'Ke90Tje7VS0',0,2400,0],[['React crash course','React crash course','React : cours accéléré'],'sBws8MSXN7A',0,3000,0]]},
 {cr:mariana,cat:'tech',img:'img12.jpg',price:4.99,badge:'ESSENTIAL',src:SRC('freeCodeCamp.org (Giraffe Academy)'),
  t:C(['Bases de Dados SQL','Consultas e modelação de dados','Aprende SQL com MySQL: tabelas, consultas, joins e funções.'],['SQL Databases','Queries and data modelling','Learn SQL with MySQL: tables, queries, joins and functions.'],['Bases de données SQL','Requêtes et modélisation','Apprends le SQL avec MySQL : tables, requêtes, jointures et fonctions.']),
  L:[[['O que é uma base de dados','What is a database','Qu’est-ce qu’une base de données'],'HXV3zeQKqGY',0,1300,1],[['Criar tabelas e inserir dados','Creating tables & inserting data','Créer des tables et insérer des données'],'HXV3zeQKqGY',1800,1500,0],[['Joins e subconsultas','Joins & subqueries','Jointures et sous-requêtes'],'HXV3zeQKqGY',7800,1500,0]]},
 {cr:mariana,cat:'ai',img:'img8.jpg',price:12.99,badge:'PREMIUM',src:SRC('3Blue1Brown · freeCodeCamp.org'),
  t:C(['Redes Neuronais e Deep Learning','Entende a IA por dentro','Intuição visual de redes neuronais, gradiente descendente e backpropagation, e prática com PyTorch.'],['Neural Networks & Deep Learning','Understand AI from the inside','Visual intuition of neural networks, gradient descent and backpropagation, plus hands-on PyTorch.'],['Réseaux de neurones et Deep Learning','Comprends l’IA de l’intérieur','Intuition visuelle des réseaux de neurones, descente de gradient et rétropropagation, avec PyTorch.']),
  L:[[['O que é uma rede neuronal?','What is a neural network?','Qu’est-ce qu’un réseau de neurones ?'],'aircAruvnKk',0,1110,1],[['Gradiente descendente','Gradient descent','Descente de gradient'],'IHZwWFHWa-w',0,1260,0],[['Backpropagation','Backpropagation','Rétropropagation'],'Ilg3gGewQ5U',0,830,0],[['PyTorch na prática','PyTorch in practice','PyTorch en pratique'],'V_xro1bcAuA',0,3600,0]]},
 {cr:mariana,cat:'tech',img:'img6.jpg',price:0,free:1,src:SRC('freeCodeCamp.org'),
  t:C(['Introdução à Programação','Ciência da computação para todos','Conceitos fundamentais de programação e uma introdução ao C++.'],['Intro to Programming','Computer science for everyone','Core programming concepts and an introduction to C++.'],['Introduction à la programmation','L’informatique pour tous','Concepts fondamentaux de la programmation et introduction au C++.']),
  L:[[['Como pensa um computador','How a computer thinks','Comment pense un ordinateur'],'zOjov-2OZ0E',0,1800,1],[['Algoritmos e estruturas','Algorithms & structures','Algorithmes et structures'],'zOjov-2OZ0E',1800,1800,0],[['Primeiros passos em C++','First steps in C++','Premiers pas en C++'],'8jLOx1hD3_o',0,2400,0]]},
 {cr:ricardo,cat:'design',img:'img4.jpg',price:12.99,badge:'PREMIUM',src:SRC('Blender Guru · Blender Foundation (filmes CC BY)'),
  t:C(['Blender 3D para Iniciantes','Modelação, materiais e render','Cria o teu primeiro modelo 3D e analisa curtas-metragens abertas da Blender Foundation.'],['Blender 3D for Beginners','Modelling, materials & rendering','Create your first 3D model and study open short films by the Blender Foundation.'],['Blender 3D pour débutants','Modélisation, matériaux et rendu','Crée ton premier modèle 3D et étudie les courts-métrages libres de la Blender Foundation.']),
  L:[[['Interface e primeiro modelo','Interface & first model','Interface et premier modèle'],'nIoXOplUvAw',0,1500,1],[['Estudo de caso: Big Buck Bunny','Case study: Big Buck Bunny','Étude de cas : Big Buck Bunny'],'aqz-KE-bpKQ',0,630,0],[['Estudo de caso: Sintel','Case study: Sintel','Étude de cas : Sintel'],'eRsGyueVLvQ',0,890,0]]},
 {cr:ricardo,cat:'design',img:'img7.jpg',price:4.99,badge:'ESSENTIAL',src:SRC('Blender Foundation / Blender Studio (CC BY)'),
  t:C(['Cinema de Animação Aberto','Narrativa e VFX em filmes livres','Analisa narrativa, iluminação e efeitos visuais em filmes Creative Commons.'],['Open Animation Cinema','Storytelling & VFX in open films','Analyse storytelling, lighting and visual effects in Creative Commons films.'],['Cinéma d’animation libre','Narration et VFX dans les films libres','Analyse la narration, l’éclairage et les effets visuels dans des films Creative Commons.']),
  L:[[['Spring: cor e atmosfera','Spring: colour & mood','Spring : couleur et atmosphère'],'WhWc3b3KhnY',0,460,1],[['Tears of Steel: VFX','Tears of Steel: VFX','Tears of Steel : VFX'],'R6MlUcmOul8',0,730,0]]},
 {cr:ricardo,cat:'food',img:'img3.jpg',price:4.99,badge:'ALL ACCESS',src:SRC('Tasty · TheCooknShare'),
  t:C(['Cozinha: Técnicas Essenciais','Facas, cortes e receitas simples','Domina os cortes básicos e prepara receitas rápidas do dia a dia.'],['Cooking: Essential Techniques','Knives, cuts and simple recipes','Master basic cuts and cook quick everyday recipes.'],['Cuisine : techniques essentielles','Couteaux, découpes et recettes simples','Maîtrise les découpes de base et prépare des recettes rapides du quotidien.']),
  L:[[['Técnicas básicas de faca','Basic knife skills','Techniques de base au couteau'],'G-Fg7l7G1zw',0,240,1],[['Receita: frango teriyaki no forno','Recipe: teriyaki chicken bake','Recette : poulet teriyaki au four'],'4aZr5hZXP_s',0,420,0]]},
 {cr:ricardo,cat:'fitness',img:'img1.jpg',price:0,free:1,src:SRC('Yoga With Adriene'),
  t:C(['Yoga para Iniciantes','20 minutos por dia','Uma prática suave para começar o yoga em casa.'],['Yoga for Beginners','20 minutes a day','A gentle practice to start yoga at home.'],['Yoga pour débutants','20 minutes par jour','Une pratique douce pour commencer le yoga chez soi.']),
  L:[[['Prática completa para iniciantes','Complete beginner practice','Pratique complète pour débutants'],'v7AYKMP6rOE',0,1260,1]]},
 {cr:ricardo,cat:'travel',img:'img10.jpg',price:12.99,badge:'PREMIUM',src:SRC('Jacob + Katie Schwarz · Blender Foundation (CC BY)'),
  t:C(['Fotografia e Vídeo de Viagem','Captura o mundo com outro olhar','Composição, luz e movimento para filmar as tuas viagens.'],['Travel Photography & Video','See the world differently','Composition, light and movement to film your travels.'],['Photo et vidéo de voyage','Capture le monde autrement','Composition, lumière et mouvement pour filmer tes voyages.']),
  L:[[['Inspiração: Costa Rica em 4K','Inspiration: Costa Rica in 4K','Inspiration : le Costa Rica en 4K'],'LXb3EKWsInQ',0,600,1],[['Cor e luz cinematográfica','Cinematic colour & light','Couleur et lumière cinématographiques'],'R6MlUcmOul8',0,730,0],[['Contar histórias com imagens','Storytelling with images','Raconter des histoires en images'],'eRsGyueVLvQ',0,890,0]]},
];
const ids=[];
const EXTRA=require('./extra_courses.json');
for(const e of EXTRA){const cr=['tech','ai','biz','mech'].includes(e.cat)?mariana:ricardo;
  courses.push({cr,cat:e.cat,price:e.price,free:e.price===0?1:0,badge:e.badge,yt:e.lessons[0].id,
    src:SRC([...new Set(e.lessons.map(l=>l.author))].join(' · ')),t:C([e.t[0],e.st[0],e.d[0]],[e.t[1],e.st[1],e.d[1]],[e.t[2],e.st[2],e.d[2]]),
    L:e.lessons.map((l,i)=>[l.titles,l.id,0,l.sec,i===0?1:0])})}
for(const c of courses){c.img='yt/'+(c.yt||c.L.find(l=>l[4])[1])+'.jpg';const id=db.run('INSERT INTO courses(creator_id,category,i18n,image,price,is_free,badge,source) VALUES(?,?,?,?,?,?,?,?)',[c.cr,c.cat,c.t,'assets/'+c.img,c.price,c.free?1:0,c.free?'FREE':c.badge,c.src]);
  c.L.forEach((l,i)=>db.run('INSERT INTO lessons(course_id,position,i18n,youtube_id,start_sec,duration_sec,free_preview) VALUES(?,?,?,?,?,?,?)',[id,i+1,T(...l[0]),l[1],l[2],l[3],l[4]]));ids.push(id)}
// ---- simulação: alunos, pagamentos e visualizações no mês corrente
let seed=42;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
const now=new Date(),ym=now.toISOString().slice(0,7),day=()=>`${ym}-${String(1+Math.floor(rnd()*Math.max(1,now.getUTCDate()-1))).padStart(2,'0')} ${String(Math.floor(rnd()*23)).padStart(2,'0')}:15:00`;
const learners=[aluno];const ph=H('Aluno123!');
for(let i=1;i<=24;i++)learners.push(db.run('INSERT INTO users(email,name,pass,role) VALUES(?,?,?,?)',[`aluno${i}@worldcourses.test`,`Aluno Demo ${i}`,ph,'user']));
const pay=(u,kind,amount,cid,lid,when,ends)=>db.run('INSERT INTO payments(user_id,kind,course_id,lesson_id,amount,provider,provider_ref,status,starts_at,ends_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',[u,kind,cid,lid,amount,'mock','mock_seed_'+Math.random().toString(36).slice(2,8),'paid',kind==='subscription'?when:null,ends,when]);
const subs=new Set();
learners.forEach((u,i)=>{const w=day();
  if((i+1)%3===0){subs.add(u);pay(u,'subscription',39.99,null,null,w,db.get(`SELECT datetime(?,'+1 month') e`,[w]).e)}
  else if((i+1)%3===1){const c=courses[[1,2,4,6,10][i%5]];const cid=ids[courses.indexOf(c)];pay(u,'course',c.price,cid,null,w,null)}
  else{const l=db.get('SELECT id,course_id FROM lessons WHERE free_preview=0 ORDER BY id LIMIT 1 OFFSET ?',[i%12]);pay(u,'lesson',4.99,l.course_id,l.id,w,null)}});
const lessons=db.all('SELECT l.id,l.course_id,l.duration_sec,c.creator_id FROM lessons l JOIN courses c ON c.id=l.course_id');
for(let k=0;k<1100;k++){const u=learners[Math.floor(rnd()*learners.length)],l=lessons[Math.floor(rnd()*lessons.length)];
  const r=rnd(),pct=r<0.45?0.92+rnd()*0.08:r<0.85?0.1+rnd()*0.8:rnd()*0.1;
  db.run('INSERT INTO views(user_id,lesson_id,course_id,creator_id,seconds,pct,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',[u,l.id,l.course_id,l.creator_id,Math.round(pct*l.duration_sec),Math.min(1,pct),day(),day()])}
db.saveNow();console.log('Seed concluído:',courses.length,'cursos,',lessons.length,'aulas,',learners.length,'alunos.');
})();
