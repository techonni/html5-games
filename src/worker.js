// zunrel.com → Cloudflare Pages (projeto "zunrel", ligado ao repositório techonni/zunrel).
// O Pages publica cada merge no main do zunrel; este Worker só reencaminha os pedidos.
const ORIGIN = 'zunrel.pages.dev';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    url.hostname = ORIGIN;
    url.protocol = 'https:';
    url.port = '';
    return fetch(new Request(url, request));
  },
};
