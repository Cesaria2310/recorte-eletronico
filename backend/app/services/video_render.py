"""Renderização de vídeo (Remotion) para um post.

Invoca o workspace Remotion em `video/` via `render.mjs`, gerando um reel
vertical (mídia + legenda + hashtags + CTA). O resultado é salvo em uploads e
vira um MediaAsset de vídeo, além de ser linkado ao draft.

Requer Node + (no render) um Chromium. Se `REMOTION_BROWSER_EXECUTABLE` apontar
para um Chromium existente, ele é usado. Em ambientes sem Chromium/ffmpeg, a
função degrada graciosamente retornando ok=False com o motivo.
"""
import json
import os
import subprocess
import tempfile
import uuid
from dataclasses import dataclass

from ..config import get_settings
from .. import models

settings = get_settings()


@dataclass
class RenderResult:
    ok: bool
    url: str | None
    detail: str


def _backend_root() -> str:
    # .../backend/app/services -> .../backend
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def _video_dir() -> str:
    return os.path.abspath(os.path.join(_backend_root(), settings.video_dir))


def render_draft_video(db, draft: models.PostDraft) -> RenderResult:
    video_dir = _video_dir()
    render_script = os.path.join(video_dir, "render.mjs")
    if not os.path.exists(render_script):
        return RenderResult(False, None, "Workspace Remotion ausente (video/render.mjs não encontrado).")

    media = draft.media_asset
    # Mídia base: passa o caminho absoluto local (o render.mjs copia para
    # public/ e o PostReel usa staticFile); se não existir, cai para a URL.
    if media and media.stored_path and os.path.exists(media.stored_path):
        media_url = os.path.abspath(media.stored_path)
        media_type = media.media_type
    else:
        media_url = (media.url if media else "")
        media_type = media.media_type if media else "photo"

    props = {
        "mediaUrl": media_url,
        "mediaType": media_type,
        "caption": draft.caption or "",
        "hashtags": draft.hashtags or [],
        "cta": draft.call_to_action or "Siga e mande um direct 📩",
        "handle": draft.campaign.client.instagram_handle if draft.campaign and draft.campaign.client else "",
        "theme": (draft.campaign.detected_themes or [""])[0] if draft.campaign else "",
    }

    upload_dir = os.path.join(_backend_root(), settings.upload_dir)
    os.makedirs(upload_dir, exist_ok=True)
    out_name = f"reel_{draft.id}_{uuid.uuid4().hex[:8]}.mp4"
    out_path = os.path.join(upload_dir, out_name)

    env = os.environ.copy()
    if settings.remotion_browser_executable:
        env["REMOTION_BROWSER_EXECUTABLE"] = settings.remotion_browser_executable

    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as pf:
        json.dump(props, pf)
        props_file = pf.name

    try:
        proc = subprocess.run(
            ["node", "render.mjs", f"--props-file={props_file}", f"--out={out_path}"],
            cwd=video_dir, env=env, capture_output=True, text=True,
            timeout=settings.video_render_timeout_s,
        )
    except FileNotFoundError:
        return RenderResult(False, None, "Node.js não encontrado no servidor.")
    except subprocess.TimeoutExpired:
        return RenderResult(False, None, "Tempo de renderização excedido.")
    finally:
        try:
            os.unlink(props_file)
        except OSError:
            pass

    if proc.returncode != 0 or not os.path.exists(out_path):
        tail = (proc.stderr or proc.stdout or "")[-500:]
        return RenderResult(False, None, f"Falha no Remotion: {tail.strip()}")

    url = f"/media/{out_name}"
    asset = models.MediaAsset(
        client_id=draft.campaign.client_id,
        media_type="video",
        original_name=out_name,
        stored_path=out_path,
        url=url,
        description=f"Reel gerado (Remotion) — post #{draft.id}",
        tags=["gerado", "remotion", "reel"],
    )
    db.add(asset)
    draft.rendered_video_url = url
    db.commit()
    return RenderResult(True, url, "Vídeo renderizado com sucesso.")
