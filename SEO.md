# SEO on-page — branch `seo-onpage`

## What changed
**Server-side (`server/seo.js`)**
- Already there before this branch: per-page, per-language title/description, canonical, hreflang (pt/en/fr + x-default), Open Graph/Twitter, robots.txt, sitemap.xml, noindex on account/creator/admin.
- Visible text is now rendered on the server: empty `data-i18n` elements get filled from `public/i18n.js`, so crawlers see the real H1/H2s and copy without running JS (the client still applies the same text).
- Course pages are rendered on the server: H1 = course title, description, creator, thumbnail with alt = title, a link back to the catalogue and to the course's category. The client replaces this with the full interactive page.
- JSON-LD: `Course` on course pages (name, description, image, language, isAccessibleForFree, provider, creator). It has **no ratings and no offers/prices**. Home gets `Organization` + `WebSite` (with a SearchAction pointing to `/?q=`).
- `og:type=article` on course pages, plus `og:image:alt` / `twitter:image:alt`. Meta descriptions are cut to about 160 characters at a word boundary.

**Front-end**
- Course thumbnails (`script.js`) and the course player/paywall images (`course.html`) use the course title as alt text. Card thumbs also get lazy-loading and width/height. Creator avatars are marked decorative (`alt=""`, `aria-hidden`) because the name is shown next to them.
- Heading order: one H1 per page. Course sidebar is now H2 "Course content" > H3 "Sources" (it was H3/H4). Footer column titles are H2 (they were H4); CSS is updated so they look the same.
- Internal links:
  - Course page: breadcrumb-style links to the catalogue, the course category (`/?cat=…#cursos`) and the FAQ.
  - Header/footer "Creators" now goes to the public creator section `/#criador` instead of the noindex dashboard.
  - Footer: added "Become a Creator" (creator signup), plus Tech/AI/Business/Cooking category links. About points to `/#launch` and Contact to the FAQ.
  - Removed the empty Blog/Careers anchors, which had no href and no page behind them.
- Asset cache-buster bumped from `?v=11` to `?v=12`.

The marketing copy, prices and stats are unchanged. No reviews or numbers were invented.

## Known follow-ups
- Unknown course ids (`/course.html?id=999`) fall back to the generic page. Consider a 404 + noindex.
- Social icons in the footer have no URLs yet. Add real profile links when they exist, and `sameAs` in the Organization JSON-LD.
- Clean URLs (`/courses/<slug>`) would beat `?id=`. That needs routing plus 301 redirects.

## Post-domain checklist (theworldcourses.com)
(from marketing/post-domain-checklist.md, with SEO steps added)
1. Namecheap > Advanced DNS: delete parking; `CNAME www -> worldcourses.onrender.com`; `ALIAS/A @ -> 216.24.57.1` (Render).
2. Render > Settings > Custom Domains: add theworldcourses.com and www; Verify; wait for HTTPS certificate.
3. Render env: `PUBLIC_URL=https://theworldcourses.com`; redeploy. **This switches canonical, hreflang, og:url, JSON-LD and the sitemap to the new domain automatically** (all built from `PUBLIC_URL` in `server/seo.js`).
4. 301-redirect worldcourses.onrender.com → theworldcourses.com (and www → apex, or the reverse; pick one) so canonicals and links agree.
5. Check: `curl -s https://theworldcourses.com/ | grep canonical`, then `/robots.txt` and `/sitemap.xml` show the new domain.
6. Stripe: update the webhook URL to https://theworldcourses.com/webhook (keep the old one until confirmed); set the public business name.
7. Re-render ads/PDFs with the new URL (`src/ads.py`, `src/onepager.py`).
8. Google Search Console + Bing Webmaster: verify the domain (DNS TXT), submit `/sitemap.xml`, then request indexing of home + top course pages.
9. Test link previews (Facebook Sharing Debugger, LinkedIn Post Inspector, X) and the Rich Results Test for Course JSON-LD.
10. Email: SMTP for receipts (Gmail app password) or email on the domain.
11. Test a small real purchase after Stripe goes live; confirm the payout to Revolut.

## Blog (branch `blog`)
- `/blog` and `/blog/<slug>`, rendered on the server by `server/seo.js` from `public/content/blog/posts.json` + `<slug>.html` (PT only, so hreflang pt only).
- Each page has its own title, description, canonical, OG/Twitter tags and BlogPosting/Blog JSON-LD. Blog URLs are in sitemap.xml.
- Linked from the footer (Company column), a blog section on the home page, and from inside the articles to categories and courses. Unknown slugs return 404.
- To add a post: add an entry to posts.json and write `<slug>.html` (body only, h2 and below).
