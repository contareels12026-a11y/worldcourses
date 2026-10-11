# The World Courses — plataforma de cursos (demo)

Tema escuro/dourado, PT/EN/FR, alunos e criadores, pagamentos **apenas em modo de teste (mock)**, pagamento a criadores por tempo de visualização ponderado.

## Como executar
```bash
cd /workspace/worldcourses
npm install          # express, express-session, bcryptjs, sql.js
npm run seed         # repõe a base de dados (data/app.sqlite) com cursos, contas e visualizações simuladas
npm start            # http://localhost:3000   (PORT=xxxx para mudar)
```
Variáveis opcionais: `PORT`, `SESSION_SECRET` (mudar em produção), `STRIPE_SECRET_KEY` (só `sk_test_…`; chaves `sk_live_` são recusadas e o servidor não arranca).

### Contas de demonstração
| Papel | Email | Palavra-passe |
|---|---|---|
| Admin | admin@worldcourses.test | Admin123! |
| Criadora | mariana@worldcourses.test | Criador123! |
| Criador | ricardo@worldcourses.test | Criador123! |
| Aluna | aluno@worldcourses.test | Aluno123! |
(+24 alunos simulados `alunoN@worldcourses.test` / `Aluno123!`)

## Estrutura
- `server/server.js` — API Express (auth com sessões + bcrypt, catálogo, controlo de acesso, checkout mock, tracking, painéis).
- `server/db.js` — SQLite (sql.js/WASM, persistido em `data/app.sqlite`).
- `server/payments.js` — preços e **placeholder Stripe** (modo mock por omissão; nunca cobra).
- `server/payout.js` — cálculo de pagamentos a criadores.
- `server/seed.js` — dados de demonstração.
- `public/` — frontend estático: `index.html`, `course.html`, `login.html`, `creator.html`, `admin.html`, `i18n.js` (todas as traduções PT/EN/FR), `app.js` (cabeçalho, idioma, tema, sessão).

## Preços para alunos
- Aula individual: **€4,99**
- Curso completo: escalão **€4,99** ou **€12,99** (escolhido pelo criador; ou grátis)
- Subscrição **All Access: €39,99** = 1 mês de acesso a tudo (renovar soma +1 mês)
- Aulas marcadas como "pré-visualização grátis" e cursos grátis estão abertos a todos.

O acesso é verificado **no servidor**: o ID do vídeo só é devolvido por `GET /api/lessons/:id/play` se o utilizador tiver direito (pré-visualização, curso grátis, compra da aula/curso, subscrição ativa, autor do curso ou admin); caso contrário responde `402`.

## Fórmula de pagamento a criadores
O preço de lista do criador é **apenas o preço apresentado**; não determina o que o criador recebe.

Para um período (mês civil):

1. **Receita bruta** `R` = Σ subscrições + Σ compras de cursos + Σ compras de aulas (pagamentos `paid` no mês).
2. **Pool de criadores** `P = R × (1 − s)`, onde `s` = quota da plataforma (por omissão 30%).
3. Cada evento de visualização regista a **percentagem vista** `pct` = segundos efetivamente reproduzidos ÷ duração da aula (máx. 100%). O peso de cada visualização é:
   - `w = 0` se `pct < min_pct` (por omissão 10% → ignorada)
   - `w = w_complete` se `pct ≥ complete_threshold` (por omissão 90% → completa, peso 1,0)
   - `w = pct × partial_factor × w_complete` caso contrário (parcial proporcional)
4. **Anti-abuso**: visualizações do criador aos seus próprios vídeos não contam; conta no máximo 1 visualização por aluno + aula + dia (a de maior %).
5. Ganhos do criador `c`: `E_c = P × (W_c / W_total)`, com `W_c` = soma dos pesos das visualizações dos vídeos de `c`.

Exemplo: R = 1 000 €, s = 30% → P = 700 €. Se a criadora A soma W = 60 e o criador B W = 40, A recebe 420 € e B 280 €.

Todos os parâmetros (`platform_share`, `w_complete`, `complete_threshold`, `min_pct`, `partial_factor`) são editáveis em **/admin.html** (conta admin). O painel de criador (`/creator.html`) mostra visualizações, completas, parciais, minutos vistos, peso, quota do pool e ganhos estimados por mês.

## Tracking de visualizações
O leitor (YouTube IFrame API) conta o tempo realmente em reprodução e envia `POST /api/views` a cada 10 s (e ao sair da página). O servidor limita os segundos à duração da aula.

## Pagamentos Stripe (modo de TESTE)
- Com `STRIPE_SECRET_KEY=sk_test_…` o checkout usa **Stripe Checkout**; sem chave, usa o modo **mock**. Chaves `sk_live_`/`rk_live_` são recusadas (o servidor não arranca) e qualquer objeto `livemode` é ignorado.
- No arranque são criados (idempotentemente, por `lookup_key`) os preços: `wc_lesson_499`, `wc_course_499`, `wc_course_1299` (pagamento único) e `wc_sub_3999` (subscrição mensal €39,99).
- Acesso concedido: (1) no regresso `/checkout/success?session_id=…` — a sessão é obtida no servidor à API Stripe e verificada; (2) via `POST /webhook` com `checkout.session.completed`, `invoice.paid` (renovações) e `customer.subscription.deleted` (termina o acesso). Com `STRIPE_WEBHOOK_SECRET` a assinatura é verificada; sem ele o evento é sempre re-obtido à API da Stripe pelo id (o corpo nunca é confiado).
- Os pagamentos ficam na tabela `payments` (`provider=stripe_test`, idempotente por id de sessão/fatura) e entram na receita usada no cálculo dos pagamentos a criadores.
- Cartão de teste: `4242 4242 4242 4242`, qualquer data futura e CVC.
- No painel Stripe (teste), criar um endpoint de webhook para `https://<domínio>/webhook` com os 3 eventos acima e copiar o segredo para `STRIPE_WEBHOOK_SECRET`.
- As chaves nunca devem ser commitadas (ver `.gitignore`). `STRIPE_PUBLISHABLE_KEY` não é necessária no Checkout alojado.

## Conteúdos e créditos
Os vídeos são incorporações públicas do YouTube de freeCodeCamp.org, Programming with Mosh, Traversy Media, 3Blue1Brown, Blender Guru, Blender Foundation/Blender Studio (filmes CC BY), Tasty, TheCooknShare, Yoga With Adriene e Jacob + Katie Schwarz; os créditos aparecem em cada curso. As aulas usam excertos (início/duração aproximados) de vídeos longos. Os preços e a divisão em cursos pagos são **fictícios para demonstração** — antes de cobrar por conteúdo de terceiros é necessário licenciamento próprio.

## Limitações conhecidas
- Sessões em memória (reiniciar o servidor termina as sessões); usar um store persistente em produção.
- Upload de ficheiros de vídeo não implementado: o criador cola um link YouTube ou um URL de vídeo direto.
- Cursos criados pelo criador ficam com o mesmo texto nas 3 línguas (sem tradução automática).
- Imagens dos cursos são fotos genéricas (picsum) e não correspondem ao tema.

## Melhorias técnicas (out. 2026)
- **Sessões persistentes**: guardadas na tabela `sessions` da mesma SQLite (`server/sessionStore.js`); sobrevivem a reinícios. Defina `SESSION_SECRET` estável em produção. (No Render, o disco é efémero: as sessões perdem-se a cada novo deploy.)
- **Ferramentas de demonstração**: o botão "Simular visualização completa" só aparece a admins quando `DEMO_TOOLS=1`.
- **SEO** (`server/seo.js`): título/descrição por idioma (`?lang=pt|en|fr`), Open Graph/Twitter, `canonical`, `hreflang`, `favicon.svg/.ico`, `/robots.txt`, `/sitemap.xml` (todas as páginas públicas × 3 idiomas). URL base via `PUBLIC_URL` (omissão: https://worldcourses.onrender.com).
- **Arranque a frio**: os mosaicos de categorias estão no HTML (aparecem sempre) e os pedidos à API repetem automaticamente em caso de 502–504 (Render a acordar). Ficheiros JS/CSS com `?v=` para evitar cache antiga.

## Idioma falado, legendas, promo de lançamento e feedback (out. 2026)
- **Idioma falado** (`courses.spoken_language`, `lessons.spoken_language`, `lessons.has_captions`): obrigatório ao criar curso e cada aula (sem valor pré-selecionado; o servidor rejeita valores inválidos). Os vídeos de demonstração foram verificados um a um em `server/video_langs.json` (faixa de áudio original / legendas automáticas do YouTube): todos em inglês, exceto 2 sem diálogo (Big Buck Bunny, Costa Rica 4K). Filtro por idioma no catálogo (`/api/courses?spoken=en`). Os vídeos abrem com legendas (`cc_load_policy=1`, `cc_lang_pref` = idioma do site).
- **Promo de lançamento**: entre `launch_date` e `launch_date + promo_months` (admin; omissão 3 meses) a All Access custa €29,99/mês. Stripe: cupão `wc_launch_until_AAAAMMDD` (€10, `forever`, `redeem_by` = fim da janela) + *subscription schedule* que muda para €39,99 sem desconto no fim da janela; um job horário remove descontos residuais. A receita regista o valor efetivamente pago.
- **Feedback da plataforma**: durante `feedback_months` após `launch_date`, ao chegar a ~50% de um curso aparece um pedido de avaliação (1–5 ★, comentário, sugestões). Uma vez por utilizador; "Mais tarde" volta a perguntar uma única vez noutro curso. Tabela `site_feedback`; lista, média e exportação CSV no admin. Só respostas reais — nada é semeado.

## Recibos por email (opcional)
3 dias após cada pagamento Stripe bem-sucedido é enviado ao comprador um resumo do pagamento (vendedor, artigo, valor, data, "Fatura-recibo emitida separadamente").
Ativa-se apenas com `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (opcionais: `SMTP_PORT`, por omissão 587; `RECEIPT_DELAY_DAYS`, por omissão 3).
Pagamentos anteriores à funcionalidade ficam marcados `legacy` e nunca recebem email. A fatura-recibo legal continua a ser emitida à parte.
