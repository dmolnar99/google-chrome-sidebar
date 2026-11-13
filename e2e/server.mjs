// Serves simple test pages, each with its own title and colored favicon, so the e2e tests
// never touch the internet. /page/<name> → a page titled "<Name> page".
import http from 'node:http';

export const PORT = 4317;
const colors = ['#e5484d', '#3e63dd', '#30a46c', '#f76b15', '#8e4ec6', '#0090ff', '#d6409f', '#ffc53d'];

const favicon = (name) => {
  const color = colors[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length];
  const letter = name[0].toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${color}"/><text x="16" y="22" font-family="Arial" font-size="18" font-weight="bold" fill="#fff" text-anchor="middle">${letter}</text></svg>`;
};

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const [, kind, name = 'home'] = url.pathname.split('/');
    if (kind === 'favicon') {
      res.writeHead(200, { 'content-type': 'image/svg+xml' }).end(favicon(name.replace('.svg', '')));
      return;
    }
    const title = `${name[0].toUpperCase()}${name.slice(1)} page`;
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(
      `<!doctype html><title>${title}</title><link rel="icon" href="/favicon/${name}.svg"><h1>${title}</h1><a href="/page/${name}-next">Next</a>`,
    );
  })
  .listen(PORT, () => console.log(`test pages on http://localhost:${PORT}`));
