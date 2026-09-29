# Pixelune Casino — jogos de casino em PixiJS

Site de casino online de **demonstração** (créditos fictícios, sem dinheiro real) com 6 jogos originais renderizados em **PixiJS v8** (WebGL/WebGPU), com um layout escuro ao estilo dos casinos "originals".

| Jogo | Descrição |
| --- | --- |
| **Plinko** | Bolas ressaltam em 8/12/16 linhas de pinos até aos multiplicadores (risco baixo/médio/alto). |
| **Mines** | Grelha 5×5: encontra diamantes, evita minas e levanta quando quiseres. |
| **Crash** | O multiplicador sobe até rebentar — levanta a tempo (manual ou automático). |
| **Dice** | Arrasta o alvo de 0 a 100 e aposta acima/abaixo. |
| **Limbo** | Define um multiplicador alvo e vê se o resultado o supera. |
| **Wheel** | Roda de 30 segmentos com três perfis de risco. |

Todos os jogos têm ~1% de vantagem da casa e usam `crypto.getRandomValues()`.

## Desenvolvimento

```bash
npm install
npm run dev      # servidor local (Vite)
npm run build    # build de produção em dist/
npm run preview  # servir o build
```

## Estrutura

```
index.html            shell do site (menu lateral, barra de topo, carteira)
src/main.js           router (#/, #/game/<id>, #/historico), lobby, ciclo de vida dos jogos
src/style.css         tema escuro e layout responsivo
src/core/stage.js     cria a Application PixiJS com resolução de design escalada
src/core/wallet.js    carteira demo (localStorage) e histórico de apostas
src/core/rng.js       aleatoriedade e distribuição crash/limbo
src/core/ui.js        controlos HTML partilhados (montante, selects, toasts)
src/games/*.js        um módulo por jogo: { id, name, rules, mount(ctx) }
```

Para adicionar um jogo, cria `src/games/<nome>.js` com `mount(ctx)` (usa `ctx.createStage()`, `ctx.controls`, `ctx.once()` para pagamentos e `ctx.recent()` para o histórico) e regista-o em `src/games/index.js`.

## Publicação

O workflow `.github/workflows/deploy.yml` publica o build no GitHub Pages a cada push para `main` (ativa em *Settings → Pages → Source: GitHub Actions*).

As skills PixiJS para agentes estão em `.claude/skills/` (instaladas com `npx skills add https://github.com/pixijs/pixijs-skills`).

## Pixelune Trader (`binary-options/`)

Simulador mobile de negociação demo em PixiJS, publicado em `/binary-options/`:

- Gráfico PixiJS com ticks (linha com gradiente) ou velas de 1m/5m, preço atual e marcadores de entrada.
- Índices sintéticos Volatility 10–100 (1s) gerados no browser (1 tick por segundo).
- Opções binárias "tudo ou nada" decididas pelo preço no segundo exato do vencimento (empate devolve a aposta):
  - **Binary**: Up/Call ou Down/Put, 1–15 min, lucro fixo de 85%.
  - **Digital**: escolha do strike (±3 níveis); o payout varia com a distância ao strike.
  - **Turbo**: 30 s a 5 min, lucro fixo de 80%.
- **Multipliers** (Up/Down, x1–x300, take profit/stop loss, stop out).
- Separadores Trade / Positions (abertas e fechadas), modo de ecrã inteiro e saldo demo de 10 000 EUR.
- Layout desktop (≥ 900px): barra lateral, separadores de mercados com P/L, painel de parâmetros (stop out, stop out level, comissão), gaveta de posições com botão Close, ferramentas do gráfico (tipo/intervalo, linhas horizontais, média móvel, exportar PNG), zoom e arrastar, relógio GMT e tema escuro.

## Clumsy Monster (`clumsy-monster/`)

Web app mobile em **three.js**, publicada em `/clumsy-monster/`:

- 6 monstros modelados em 3D só com código (primitivas, materiais físicos "vinil", iluminação de estúdio), com respiração, piscar de olhos, chama animada e tentáculos.
- Ecrã de boas-vindas com o trio de monstros e ecrã de escolha com estatísticas, halo colorido e carrossel com miniaturas renderizadas em 3D.
- Tocar num monstro faz com que tropece e caia; arrastar roda-o. O monstro escolhido fica guardado e aparece no centro do ecrã inicial.
- Um único canvas WebGL desenha várias zonas da página (scissor), por isso os monstros podem "sair" dos cartões.
- No telemóvel os ecrãs deslizam (com botão de voltar do browser); no desktop aparecem lado a lado, como no mockup.

## Zunrel Crash (`stake-crash/`)

Clone mobile-first estilo Crash em PixiJS, publicado em `/stake-crash/`:

- Marca **Zunrel** (logo SVG), moeda **C** (Coins), UI em **FR / PT** com menu hamburger (connexion / inscription + idioma).
- Canvas PixiJS v8 com curva exponencial, multiplicador 3D e tip animado; estados Waiting (5s) → Flying → Crashed.
- RTP 99% via `crypto.getRandomValues()`; cashout automático no alvo; créditos demo em Coins.
- Botões com interação real (auth demo, definições, estatísticas, equidade, chat, favorito, nav).

## Nhami (`nhami/`)

Jogo mobile em **flat design** de colecionar e alimentar monstros, publicado em `/nhami/`:

- 6 monstros originais em estilo "silhueta de tinta" (preto + azul-noite, olhos brancos em fenda), com 3 fases de evolução (níveis 5 e 10) e ficha de detalhe com fases, tipo, papel e história.
- Escolha do primeiro monstro, casa com barriga e experiência (a barriga desce com o tempo real), alimentar com comida que voa até à boca, loja com moedas, subir de nível.
- Explorar: procurar em arbustos, monstros selvagens com raridade (Comum → Lendário) e lançar a bola para os apanhar.
- Coleção com silhuetas dos monstros por descobrir e troca do monstro ativo.
- Componentes flat estilo "tátil": botões com degrau sólido, tiles com contorno de 2px, barras de progresso arredondadas. Tudo guardado no browser.
