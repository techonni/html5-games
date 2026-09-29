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

- Marca texto **zunrel**, moeda **C** (Coins), UI em **FR / PT** (idioma só no header).
- Menu hamburger em gaveta vertical (direita → esquerda); botão de saldo 2× maior.
- Crash **solo** : sem chat, sem jogadores em direto, sem campo « Retrait à »; banner Gain / Perte; pill « Crash ».
- Secção **Pour vous** com Mines, Scarab Spin e Blue Samurai (flat design + PixiJS).
- Canvas PixiJS v8; RTP 99% via `crypto.getRandomValues()`; créditos demo.

## Nhami (`nhami/`)

Jogo mobile em **flat design** de colecionar e alimentar monstros, publicado em `/nhami/`:

- 6 monstros originais em estilo "silhueta de tinta" (preto + azul-noite, olhos brancos em fenda), com 3 fases de evolução (níveis 5 e 10) e ficha de detalhe com fases, tipo, papel e história.
- Escolha do primeiro monstro, casa com barriga e experiência (a barriga desce com o tempo real), alimentar com comida que voa até à boca, loja com moedas, subir de nível.
- Explorar: procurar em arbustos, monstros selvagens com raridade (Comum → Lendário) e lançar a bola para os apanhar.
- Coleção com silhuetas dos monstros por descobrir e troca do monstro ativo.
- Componentes flat estilo "tátil": botões com degrau sólido, tiles com contorno de 2px, barras de progresso arredondadas. Tudo guardado no browser.

## Crash PixiJS (`crash-pixi/`)

Crash mobile-first feito **só com PixiJS v8 + GSAP + TypeScript**, publicado em `/crash-pixi/`:

- Toda a interface é desenhada no canvas (sem HTML/CSS de UI): cabeçalho com saldo, cena com histórico, curva com gradiente e bola, multiplicador gigante, painel de apostas, seletor Manual/Auto e teclado numérico próprio (também aceita o teclado físico; Espaço = botão principal).
- Animações em GSAP: pressão dos botões, pílulas do histórico, contagem, explosão do crash, ganho a subir, contador do saldo, folha do teclado.
- Cores e formas dos tokens "UI Design Rules – HTML5 Games"; layout em coluna no telemóvel e em duas colunas em ecrãs largos.
- Ronda solo: 5 s de contagem, `m(t) = e^(0.00006·t)`, crash com RTP 99% via `crypto.getRandomValues()`, retirada manual ou automática no alvo; créditos demo guardados no browser.
- **Som com Howler.js** (`crash-pixi/src/audio/`): cliques, aposta, tique dos últimos 3 s, arranque, motor em loop cujo tom sobe com o multiplicador, retirada e crash. Os sons são sintetizados em código (WAV gerado no browser, sem ficheiros áudio). Botão de som no cabeçalho, com a escolha guardada no browser; fica em silêncio quando o separador está escondido.
- `npm run typecheck` verifica o TypeScript (`tsconfig.json`); `npm run build` corre o typecheck antes do Vite.

## zunrel Binary (`zunrel-binary-option/`)

Recriação do simulador de opções binárias feita **só com PixiJS v8 + GSAP + TypeScript + Howler.js**, publicada em `/zunrel-binary-option/`:

- Toda a UI no canvas: cabeçalho da conta demo (10 000 EUR, Repor), seletor de mercado e de tipo de contrato, gráfico, painel Sobe/Desce com Duração / Aposta / Pagamento, botão Comprar e barra inferior Início / Negociar / Posições / Menu.
- Gráfico Pixi: linha de ticks com área em gradiente que desliza em tempo real, etiqueta de preço, eixo de horas, velas de 1 e 5 min, linhas de entrada e de vencimento com contagem, e modo expandido.
- Índices sintéticos Volatility 10–100 (1s) gerados no browser; **Binary** (1–15 min, +85%) e **Turbo** (30 s–5 min, +80%) decididos pela cotação no segundo exato do vencimento (empate devolve a aposta).
- Posições abertas (ao vivo, a ganhar/perder) e fechadas, lista de mercados com minigráficos, menu com som e reposição do saldo.
- GSAP para as transições (folhas inferiores, seletores, cotação, separadores) e Howler.js para os sons sintetizados (clique, compra, ganho, perda, empate, bip dos últimos 3 s). Setas ↑/↓ e Enter no teclado.

## Site zunrel.com (`zunrel-games/`)

Site completo da zunrel, **desenhado só com PixiJS + GSAP + TypeScript + Howler.js** (um único canvas, tema "UI Design Rules – HTML5 Games"), com os dois jogos embutidos:

- Cabeçalho com marca, navegação (Início · Crash · Binary · Sobre), som e "Jogar agora" no computador; menu lateral no telemóvel.
- Página inicial com destaque animado, cartões dos jogos com miniaturas ao vivo, vantagens e rodapé; página Sobre.
- `#/crash` e `#/binary` abrem os jogos dentro do site (cenas Pixi com layout próprio para computador e telemóvel). O Binary continua a correr em segundo plano para liquidar contratos a tempo.
- `npm run dev:zunrel` para desenvolver, `npm run build:zunrel` gera `dist-zunrel/`.
- Cloudflare: `wrangler.jsonc` publica `dist-zunrel/` como Worker com ficheiros estáticos (build `npm run build:zunrel`, deploy `npx wrangler deploy`).
