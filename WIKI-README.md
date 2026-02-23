# Sistema Wiki - 100Nome

## Visão Geral
Sistema para escrever conteúdo em `.wikimd` e gerar páginas wiki HTML com navegação, pesquisa, SEO e componentes visuais consistentes.

## Estrutura
```text
100nome-traducoes.github.io/
├── data/
│   └── wiki-content/
│       └── <slug-do-jogo>/
│           ├── index.wikimd
│           ├── pagina-1.wikimd
│           └── ...
├── templates/
│   └── wiki-page.html
├── assets/
│   ├── css/pages/wiki.css
│   ├── css/wiki/wiki-content.css
│   └── js/pages/wiki-page.js
├── scripts/
│   └── build-wiki.js
└── wiki/                              # output gerado
```

## Frontmatter
Exemplo mínimo por página:

```yaml
---
titulo: Zombies
descricao: Nomes dos zombies em PT-PT, com o original ao lado.
icone: skull
ordem: 1
---
```

Campos suportados:
- `titulo`: título da página.
- `descricao`: descrição curta para header/meta.
- `icone`: ícone MDI (sem prefixo `mdi-`).
- `ordem`: ordem da página na navegação.
- `categoria` (opcional): grupo da sidebar.
- `categoria_ordem` (opcional): ordem dos grupos na sidebar.
- `home_nav` (opcional): `highlight`, `normal` (default) ou `hidden` para a secção automática "Explorar a Wiki".
- `home_nav_ordem` (opcional): ordem específica no "Explorar a Wiki".
- `home_nav_limite` (opcional, no `index.wikimd`): número máximo de botões no "Explorar a Wiki" (default `6`).
- `usage_hidden` (opcional, no `index.wikimd`): `true` para ocultar a secção automática "Como usar esta Wiki".

## Convenções de conteúdo
- `index.wikimd` é a home da wiki.
- As outras páginas devem ter ficheiros com slug simples, por exemplo `armas.wikimd`, `conquistas.wikimd`.
- Imagens locais usam `imgs/...` dentro da pasta da própria wiki.

## Blocos automáticos na home (`index.wikimd`)
Para gerar automaticamente o menu principal da home:

```markdown
:::wiki-home-nav:::
```

O build injeta automaticamente:
- secção `Explorar a Wiki` com botões.
- dica para usar `Mostrar tudo` na sidebar.
- secção padrão `Como usar esta Wiki` (salvo `usage_hidden: true`).

## Navegação gerada automaticamente
- Sidebar sempre com `Visão Geral` fixa e visível.
- Restantes páginas agrupadas por `categoria` em grupos colapsáveis.
- Botão `Mostrar tudo / Recolher` na sidebar.
- Links `Relacionado` no fim de cada página (anterior, seguinte, visão geral).
- Pesquisa na wiki por título, headings e texto.

## Sintaxe suportada no `.wikimd`

Intro destacada:
```markdown
> [intro] Texto introdutório.
```

Highlight inline:
```markdown
==Escolha-chave==
```

Heading com ícone:
```markdown
## [icon:skull] Tipos de zombie
```

Heading com ID manual:
```markdown
## Armas contundentes {#armas-contundentes}
```

Grelha de botões:
```markdown
:::grid
- [icon:trophy] Conquistas (conquistas)
- [icon:script-text] Segredos (segredos)
:::
```

Grelha de destaque:
```markdown
:::grid-featured
- [icon:flash] Modificadores (modificadores-de-armas)
:::
```

YouTube simples:
```markdown
:::youtube wQsys-tXpME:::
```

YouTube em grupo:
```markdown
:::youtube-group
wQsys-tXpME
uUD_lAYPF-c | Comparação
:::
```

Legenda de tabela:
```markdown
:caption: Zombies principais (PT-PT vs EN)
```

Tabela com cabeçalho lateral (vertical):
```markdown
| ^ | Caminhante | Infetado |
|---|---|---|
| Nome PT | Caminhante | Infetado |
| Nome EN | Walker | Infected |
```

Imagem local:
```markdown
![Capa](imgs/capa.jpg)
```

## Build
Instalar dependências:
```bash
npm install
```

Gerar wiki:
```bash
npm run build:wiki
```

Gerar site completo:
```bash
npm run build:all
```

## Troubleshooting
- Imagens não aparecem: confirma caminho `imgs/...` e ficheiro existente.
- Página fora da sidebar: confirma `ordem` e frontmatter válido.
- Grupo errado na sidebar: confirma `categoria` e `categoria_ordem`.
- Home sem botões: confirma `:::wiki-home-nav:::` no `index.wikimd` e páginas não `hidden`.
