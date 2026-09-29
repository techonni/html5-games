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
