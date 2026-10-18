# yunoxia.one

分解して、理解して、作り替える。yunoxia は、ゆーの制作と研究の記録です。

The site lives in [`site/`](site/): an Astro static site with a small blog CMS on Cloudflare Pages Functions + D1, deployed to yunoxia.one by Cloudflare Pages from `main`.

```bash
cd site
npm install
npm run dev      # local dev server
npm run build    # → site/dist
npm run test:unit && npm run test:e2e
```

Deployment, the domain and the CMS setup are described in [`site/DEPLOY.md`](site/DEPLOY.md). Guidance for AI assistants is in [`CLAUDE.md`](CLAUDE.md).
