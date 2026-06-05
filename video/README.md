# recorte-eletronico / video

Workspace Remotion para renderizar Reels verticais para Instagram (1080x1920, 30fps).

## Instalação

```bash
cd video
npm install
```

## Preview no Studio (navegador)

```bash
npm run studio
# Abre http://localhost:3000 — preview interativo da composição PostReel
```

## Renderizar via script

### Usando um arquivo de props JSON

```bash
node render.mjs \
  --props-file=props.example.json \
  --out=/tmp/meu_reel.mp4
```

### Com props inline

```bash
node render.mjs \
  --props='{"mediaUrl":"/caminho/foto.jpg","mediaType":"photo","caption":"Texto aqui","hashtags":["#tag1","#tag2"],"cta":"Siga e manda Direct!","handle":"@meuhandle"}' \
  --out=/tmp/reel.mp4
```

### Flags disponíveis

| Flag | Descrição |
|------|-----------|
| `--props-file=<caminho>` | Caminho para arquivo JSON com as props |
| `--props=<json>` | Props como string JSON inline |
| `--out=<caminho.mp4>` | Caminho de saída (default: `out.mp4`) |
| `--composition=PostReel` | ID da composição (default: `PostReel`) |
| `--duration=<frames>` | Sobrescreve durationInFrames (ex: `60` = 2s, `240` = 8s) |

### Usando Chromium pré-instalado (sem download)

Se você tiver o Chromium instalado (ex: via `npx @remotion/install-browser`):

```bash
REMOTION_BROWSER_EXECUTABLE=/tmp/chromium node render.mjs \
  --props-file=props.example.json \
  --out=/tmp/reel.mp4
```

### Instalar Chromium no diretório padrão do Remotion

```bash
npx remotion browser ensure
# Instala em ~/.cache/puppeteer ou caminho padrão do Remotion
```

## Props da composição `PostReel`

```json
{
  "mediaUrl": "https://... ou /caminho/local/foto.jpg",
  "mediaType": "photo",
  "caption": "Legenda principal do reel (máx ~160 chars)",
  "hashtags": ["#reels", "#viral", "#brasil"],
  "cta": "Siga @handle • Mande um Direct 📩",
  "handle": "@meuhandle",
  "theme": "dark",
  "durationInFrames": 240
}
```

- `mediaType`: `"photo"` (com efeito Ken Burns) ou `"video"` (OffthreadVideo)
- `mediaUrl`: URL `https://...` ou caminho local (o script converte para `file://`)
- `durationInFrames`: 240 = 8s a 30fps; use `--duration` para sobrescrever na CLI

## Estrutura

```
video/
├── package.json
├── remotion.config.mjs
├── render.mjs           ← script de renderização
├── props.example.json   ← props de exemplo
├── test_media.png       ← imagem local para testes offline
└── src/
    ├── index.jsx        ← registerRoot
    ├── Root.jsx         ← define a Composition
    └── PostReel.jsx     ← composição visual principal
```
