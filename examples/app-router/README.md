# App Router example

Minimal Next.js 16 app using `@calliarc/nextjs-seo-kit`.

```bash
# from the repository root
npm install && npm run build
cd examples/app-router
npm install
npm run build && npm start
```

Try:

- `curl -I http://localhost:3000/www.example.com/privacy-policy/` -> 308 to `/privacy-policy/`
- `curl -I -H "Host: example.com" http://localhost:3000/privacy-policy/` -> 308 to `https://www.example.com/privacy-policy/`
- `http://localhost:3000/sitemap.xml` and `/robots.txt` -> absolute `https://www.example.com/...` URLs
