# html5-games → Worker "zunrel"

O site de jogos **zunrel** (PixiJS + GSAP + TypeScript + Howler.js) vive em **[techonni/zunrel](https://github.com/techonni/zunrel)** e é publicado pelo Cloudflare Pages (`zunrel.pages.dev`) a cada merge no `main`.

Este repositório só tem o Worker Cloudflare "zunrel", a que o domínio zunrel.com está ligado: ele reencaminha todos os pedidos para `zunrel.pages.dev` (`src/worker.js`). Não é preciso mexer aqui para atualizar o site.

O código antigo (Pixelune Casino, Clumsy Monster, Nhami, Trader, Crash) continua no histórico do git.
