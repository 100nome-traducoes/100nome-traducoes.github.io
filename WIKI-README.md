# 📚 Sistema Wiki - 100Nome

## Como Funciona

Sistema simples para criar wikis de traduções usando **Markdown** e converter automaticamente em HTML bonito.

---

## 📁 Estrutura de Ficheiros

```
100nome/
├── wiki-content/           # Ficheiros wiki em markdown
│   ├── dead-island/
│   │   ├── zombies.wikimd
│   │   ├── armas.wikimd
│   │   └── lugares.wikimd
│   └── gta-san-andreas/
│       └── missoes.wikimd
│
├── templates/
│   └── wiki-template.html  # Template HTML
│
├── jogo/                   # Output (gerado)
│   ├── dead-island-wiki/
│   │   ├── zombies.html
│   │   ├── armas.html
│   │   └── lugares.html
│   └── ...
│
└── build-wiki.js           # Script de build
```

---

## ✍️ Como Escrever uma Wiki

### 1. Criar Ficheiro `.wikimd`

Cria um ficheiro em `wiki-content/[nome-do-jogo]/[pagina].wikimd`

### 2. Formato do Ficheiro

```markdown
---
jogo: dead-island
titulo: Zombies
descricao: Tipos de zombies e suas traduções
icone: skull
ordem: 1
---

# Título Principal

Texto normal aqui. Podes usar **negrito**, *itálico*, [links](#), etc.

## Secção

### Subsecção

## Tabelas de Tradução

| Nome PT | Nome EN | Imagem | Notas |
|---------|---------|--------|-------|
| Caminhante | Walker | https://imgur.com/imagem.jpg | Explicação aqui |
| Infetado | Infected | https://imgur.com/imagem2.jpg | Outra nota |

## Notas do Tradutor

> **João Frade**: As minhas notas sobre a tradução vão aqui.

## Links

- [Outra página wiki](/jogo/dead-island-wiki/armas.html)
- [Voltar ao jogo](/jogo/dead-island.html)
```

---

## 🎨 Elementos Disponíveis

### Metadata (Frontmatter)

```yaml
---
jogo: dead-island          # ID do jogo (obrigatório)
titulo: Zombies            # Título da página (obrigatório)
descricao: Breve descrição # Para meta tags
icone: skull               # Ícone FontAwesome (sem 'fa-')
ordem: 1                   # Ordem na sidebar (opcional)
---
```

### Tabelas

**Simples:**
```markdown
| Nome PT | Nome EN | Notas |
|---------|---------|-------|
| Termo 1 | Term 1  | Info  |
```

**Com Imagens:**
```markdown
| Nome PT | Nome EN | Imagem | Notas |
|---------|---------|--------|-------|
| Termo | Term | https://imgur.com/abc.jpg | Info |
```

O script converte URLs de imagens automaticamente em tags `<img>`.

### Notas do Tradutor

```markdown
> **Nome do Tradutor**: Texto da nota aqui.
> Pode ter várias linhas.
```

Renderiza como uma caixa bonita com ícone.

### Caixas de Informação

```markdown
> Qualquer blockquote sem nome renderiza como info box.
```

### Listas

```markdown
- Item 1
- Item 2
  - Subitem
```

### Links

```markdown
[Texto do link](/caminho/para/pagina.html)
[Link externo](https://example.com)
```

---

## 🚀 Usar o Build Script

### Instalação

```bash
npm install marked
```

### Executar

```bash
node build-wiki.js
```

### O que faz:

1. ✅ Lê todos os ficheiros `.wikimd` em `wiki-content/`
2. ✅ Converte Markdown → HTML
3. ✅ Processa tabelas e imagens
4. ✅ Cria navegação automática na sidebar
5. ✅ Gera ficheiros HTML completos em `/jogo/[jogo]-wiki/`

---

## 📝 Exemplo Completo

### Input: `wiki-content/dead-island/zombies.wikimd`

```markdown
---
jogo: dead-island
titulo: Zombies
descricao: Tipos de zombies do Dead Island
icone: skull
ordem: 1
---

# Zombies

Esta é a wiki de zombies do Dead Island.

## Tipos Principais

| Nome PT | Nome EN | Notas |
|---------|---------|-------|
| Caminhante | Walker | Zombie lento |
| Infetado | Infected | Zombie rápido |

> **João Frade**: Optei por "Caminhante" para manter simplicidade.

## Ver Também

- [Armas](armas.html)
- [Voltar ao jogo](../dead-island.html)
```

### Output: `jogo/dead-island-wiki/zombies.html`

Página HTML completa com:
- ✅ Navbar do site
- ✅ Breadcrumbs
- ✅ Sidebar com navegação
- ✅ Conteúdo formatado
- ✅ Tabelas bonitas
- ✅ Notas destacadas
- ✅ Footer

---

## 🎯 Vantagens

1. **Rápido**: Escreves em Markdown simples
2. **Sem HTML**: Não precisas escrever tags
3. **Automático**: Script converte tudo
4. **Consistente**: Todas as páginas têm o mesmo visual
5. **Fácil Manutenção**: Editar é só editar o `.wikimd`
6. **SEO Friendly**: HTML estático gerado

---

## 🔧 Personalização

### Mudar Template

Edita `templates/wiki-template.html` para alterar:
- Estrutura HTML
- Placeholders disponíveis: `{{TITULO}}`, `{{CONTEUDO}}`, etc.

### Mudar Estilos

Edita `wiki.css` para alterar aparência.

### Adicionar Funcionalidades

Edita `build-wiki.js`:
- Função `processMarkdown()` - adicionar transformações
- Função `convertTablesToHTML()` - customizar tabelas
- Função `convertBlockquotes()` - customizar notas

---

## 📊 Ícones Disponíveis

Podes usar qualquer ícone do FontAwesome (sem o prefixo `fa-`):

- `skull` - Zombies
- `crosshairs` - Armas
- `map-marker-alt` - Lugares
- `wrench` - Mods
- `trophy` - Conquistas
- `tasks` - Missões
- `book-open` - Capítulos
- `key` - Segredos
- `star` - Habilidades
- `gamepad` - Genérico

---

## 🐛 Troubleshooting

### Imagens não aparecem
- Verifica se o URL está correto
- URLs devem estar completos: `https://...`

### Tabela não formatou bem
- Verifica que tens `|` em todas as células
- Linha de separação deve ter `---`

### Sidebar vazia
- Verifica que todos os ficheiros têm frontmatter correto
- Campo `ordem` define a posição

### Erro no build
```bash
npm install marked  # Instalar dependências
```

---

## 📚 Exemplos de Wikis

### Wiki Simples (só termos)

```markdown
---
jogo: jogo-x
titulo: Termos Comuns
icone: book
---

# Termos Comuns

| PT | EN |
|----|-----|
| Saltar | Jump |
| Correr | Run |
```

### Wiki Complexa (com tudo)

```markdown
---
jogo: jogo-x
titulo: Armas Completo
icone: crosshairs
ordem: 2
---

# Armas

## Armas Brancas

| Nome PT | Nome EN | Imagem | Dano | Notas |
|---------|---------|--------|------|-------|
| Machado | Axe | url | 50 | Lento mas forte |

## Armas de Fogo

| Nome PT | Nome EN | Cadência | Notas |
|---------|---------|----------|-------|
| Pistola | Pistol | Média | Munição comum |

> **Tradutor**: Mantive nomes literais para clareza.

## Mods

Ver [página de mods](mods.html) para mais detalhes.
```

---

Feito com ❤️ para o 100Nome! 🎮
