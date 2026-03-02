# Migração para `site-source` (privado)

## 1) Copiar esta pasta para o repo `site-source`

No teu terminal:

```bash
rsync -a --delete /home/joao/Documentos/GitHub/100nome-traducoes.github.io/site-source-staging/ /CAMINHO/DO/site-source/
```

## 2) Confirmar ficheiros no `site-source`

Devem existir:

- `scripts/`
- `templates/`
- `assets/`
- `data/` (inclui `jogos.json` e `*.wikimd`)
- `.github/workflows/`
- `package.json` + `package-lock.json`

## 3) Push do `site-source`

```bash
cd /CAMINHO/DO/site-source
git add .
git commit -m "chore: importar fontes privadas do site"
git push
```

## 4) Rodar deploy para Codeberg

No GitHub do `site-source`:

1. `Actions`
2. Workflow `Deploy Site to Codeberg`
3. `Run workflow`

## 5) Secrets necessários no repo `site-source`

- `CODEBERG_REPO` -> `owner/repo`
- `CODEBERG_USERNAME` -> teu user Codeberg
- `CODEBERG_TOKEN` -> token com write no repo
- `CODEBERG_BRANCH` -> branch de publicação (ou vazio para `main`)
- `SHEETS_METADATA_URL` -> já usado pelo sync de metadados

## 6) O que vai para o público (Codeberg)

O workflow publica apenas ficheiros estáticos/runtime e exclui fontes privadas.

Removido da publicação pública:

- `scripts/`
- `templates/`
- `data/game-content/jogos.json`
- `data/wiki-content/**/*.wikimd`

## 7) Nota sobre imagens

Neste staging, imagens de branding foram reorganizadas para:

- `assets/images/site/`

Referências já atualizadas em `templates/`, `assets/css/` e `scripts/`.
