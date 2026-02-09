# 📚 Sistema Wiki - 100Nome

## Visão Geral
Sistema simples para criar wikis de traduções usando **Markdown** e gerar HTML consistente.

---

## 📁 Estrutura Atual

```
100nome-traducoes.github.io/
├── data/
│   └── wiki-content/                 # Conteúdo wiki (.wikimd)
│       └── dead-island-pt-pt-tuga-definitive-34406/
│           ├── index.wikimd
│           ├── zombies.wikimd
│           └── ...
├── templates/
│   ├── wiki-page.html                 # Template principal da wiki
│   └── partials/
│       ├── header.html
│       └── footer.html
├── wiki/                              # Output gerado
│   └── dead-island-pt-pt-tuga-definitive-34406/
│       ├── index.html
│       ├── zombies.html
│       └── ...
├── scripts/
│   └── build-wiki.js
└── wiki.css
```

---

## ✍️ Como Escrever uma Wiki

### 1) Criar ficheiro `.wikimd`
Cria um ficheiro em:
`data/wiki-content/[id-do-jogo]/[pagina].wikimd`

### 2) Frontmatter obrigatório

```yaml
---
titulo: Zombies
descricao: Nomes dos zombies em PT-PT, com o original ao lado.
icone: skull
ordem: 1
---
```

### 3) Markdown normal + extensões

#### Intro destacada (tipo `>`)
```markdown
> [intro] Texto introdutório da página.
```

#### Highlight inline
```markdown
==Escolha chave==
```

#### Títulos com ícones (Pictogrammers / MDI)
```markdown
## [icon:skull] Zombies principais
### [icon:star] Zombies especiais
```
Usa nomes de ícones da biblioteca MDI (sem o prefixo `mdi-`).

#### IDs manuais em títulos
```markdown
## Armas brancas {#brancas}
```
Fica com `id="brancas"` para usar em âncoras.

#### Grelha de botões (para tópicos)
```markdown
:::grid
- [icon:skull] Zombies (zombies.html)
- [icon:gun] Armas (armas.html)
- [icon:map-marker-alt] Lugares (lugares.html)
:::
```

#### YouTube (embed simples)
```markdown
:::youtube wQsys-tXpME
:::
```

#### Captions de tabelas
Coloca antes da tabela:
```markdown
:caption: Zombies principais (PT-PT vs EN)
| ... |
```

#### Tabelas com cabeçalho lateral (vertical)
Ativa com `^` na primeira célula do header:
```markdown
| ^ | Caminhante | Infetado |
|---|---|---|
| Nome PT | Caminhante | Infetado |
| Nome EN | Walker | Infected |
```

Se o primeiro header for só `^`, o `thead` é removido (só cabeçalhos laterais):
```markdown
| ^ | A | B |
|---|---|---|
| Nome PT | ... | ... |
```

#### Imagens
- Usa caminhos curtos para imagens locais:
```markdown
![Capa](imgs/capa.jpg)
```
O build converte automaticamente para `/data/wiki-content/<jogo>/imgs/...`.

- URLs externas também funcionam.

---

## 🎨 Elementos Disponíveis (Resumo)

- **Intro destacada:** `> [intro] ...`
- **Highlight:** `==texto==`
- **Títulos com ícones:** `## [icon:skull] ...`
- **Grelha de botões:** `:::grid ... :::`
- **Caption de tabela:** `:caption: ...`
- **Cabeçalho lateral de tabelas:** `^`
- **Imagens locais:** `imgs/...`

---

## 🚀 Build

### Instalação
```bash
npm install
```

### Gerar a wiki
```bash
npm run build:wiki
```

### Build completo (site)
```bash
npm run build:all
```

---

## 🔧 Personalização

- **Template:** `templates/wiki-page.html`
- **CSS:** `wiki.css`
- **Build:** `scripts/build-wiki.js`

---

## 🐛 Troubleshooting

**Imagens não aparecem**
- Confirma que usaste `imgs/...` ou URL completa

**Tabelas não formatam**
- Verifica os `|` e a linha de separação `---`

**Sidebar vazia**
- Confirma frontmatter e `ordem`

---

Feito para manter a wiki rápida, consistente e fácil de editar.
