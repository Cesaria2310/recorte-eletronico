import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/**
 * Resolve a mediaUrl to a URL the browser can load:
 * - http(s) URLs are passed through as-is
 * - Anything else is treated as a public/-relative path → staticFile()
 */
function resolveMediaUrl(url) {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  // public-relative path (e.g. "media/test_media.png")
  return staticFile(url);
}

// ─── Ken Burns effect for photos ───────────────────────────────────────────
function KenBurnsPhoto({ src }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const scale = interpolate(frame, [0, durationInFrames], [1.0, 1.08], {
    extrapolateRight: "clamp",
  });

  const resolvedSrc = resolveMediaUrl(src);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
      }}
    >
      <Img
        src={resolvedSrc}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      />
    </div>
  );
}

// ─── Video background ──────────────────────────────────────────────────────
function VideoBackground({ src }) {
  const resolvedSrc = resolveMediaUrl(src);
  return (
    <AbsoluteFill>
      <OffthreadVideo
        src={resolvedSrc}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
    </AbsoluteFill>
  );
}

// ─── Dark gradient overlay ─────────────────────────────────────────────────
function GradientOverlay() {
  return (
    <AbsoluteFill
      style={{
        background: `
          linear-gradient(
            to bottom,
            rgba(0,0,0,0.45) 0%,
            rgba(0,0,0,0.0) 25%,
            rgba(0,0,0,0.0) 45%,
            rgba(0,0,0,0.75) 75%,
            rgba(0,0,0,0.92) 100%
          )
        `,
      }}
    />
  );
}

// ─── Handle watermark (top) ────────────────────────────────────────────────
function HandleWatermark({ handle }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 72,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 10,
      }}
    >
      <div
        style={{
          background: "rgba(255,255,255,0.18)",
          backdropFilter: "blur(6px)",
          borderRadius: 999,
          paddingLeft: 32,
          paddingRight: 32,
          paddingTop: 14,
          paddingBottom: 14,
          border: "1.5px solid rgba(255,255,255,0.35)",
        }}
      >
        <span
          style={{
            fontFamily: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
            fontWeight: 700,
            fontSize: 36,
            color: "#ffffff",
            letterSpacing: 1,
            textShadow: "0 2px 8px rgba(0,0,0,0.5)",
          }}
        >
          {handle}
        </span>
      </div>
    </div>
  );
}

// ─── Caption block (slide-up + fade) ──────────────────────────────────────
function CaptionBlock({ caption, hashtags, fps, frame }) {
  const captionStart = 20;
  const hashtagStart = 30;

  const captionProgress = spring({
    frame: frame - captionStart,
    fps,
    config: { damping: 18, stiffness: 140, mass: 0.8 },
  });

  const captionOpacity = interpolate(
    frame,
    [captionStart, captionStart + 15],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const captionY = interpolate(captionProgress, [0, 1], [60, 0]);

  const hashtagProgress = spring({
    frame: frame - hashtagStart,
    fps,
    config: { damping: 18, stiffness: 120, mass: 0.9 },
  });

  const hashtagOpacity = interpolate(
    frame,
    [hashtagStart, hashtagStart + 15],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const hashtagY = interpolate(hashtagProgress, [0, 1], [40, 0]);

  const truncatedCaption =
    caption.length > 160 ? caption.slice(0, 157) + "..." : caption;

  const hashtagString = Array.isArray(hashtags)
    ? hashtags.slice(0, 8).join(" ")
    : String(hashtags);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 260,
        left: 0,
        right: 0,
        paddingLeft: 56,
        paddingRight: 56,
        display: "flex",
        flexDirection: "column",
        gap: 20,
        zIndex: 10,
      }}
    >
      {/* Caption */}
      <div
        style={{
          opacity: captionOpacity,
          transform: `translateY(${captionY}px)`,
        }}
      >
        <p
          style={{
            fontFamily:
              "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
            fontWeight: 700,
            fontSize: 52,
            color: "#ffffff",
            margin: 0,
            lineHeight: 1.35,
            textShadow: "0 3px 12px rgba(0,0,0,0.7)",
            letterSpacing: -0.5,
          }}
        >
          {truncatedCaption}
        </p>
      </div>

      {/* Hashtags */}
      <div
        style={{
          opacity: hashtagOpacity,
          transform: `translateY(${hashtagY}px)`,
        }}
      >
        <p
          style={{
            fontFamily:
              "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
            fontWeight: 500,
            fontSize: 34,
            color: "rgba(180,210,255,0.95)",
            margin: 0,
            lineHeight: 1.5,
            textShadow: "0 2px 8px rgba(0,0,0,0.6)",
            letterSpacing: 0.3,
          }}
        >
          {hashtagString}
        </p>
      </div>
    </div>
  );
}

// ─── CTA pill (pulse animation) ────────────────────────────────────────────
function CTAPill({ cta, handle, frame }) {
  const ctaStart = 40;

  const ctaOpacity = interpolate(frame, [ctaStart, ctaStart + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Subtle pulse: scale oscillates between 1.0 and 1.025
  const pulse = 1 + 0.025 * Math.sin((frame / 30) * Math.PI * 1.2);

  const ctaText =
    cta && cta.trim()
      ? cta
      : `Siga ${handle} • Mande um Direct 📩`;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 100,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 10,
        opacity: ctaOpacity,
        transform: `scale(${pulse})`,
      }}
    >
      <div
        style={{
          background:
            "linear-gradient(135deg, #f5a623 0%, #f02b63 50%, #a020f0 100%)",
          borderRadius: 999,
          paddingLeft: 52,
          paddingRight: 52,
          paddingTop: 24,
          paddingBottom: 24,
          boxShadow: "0 8px 32px rgba(240,43,99,0.45), 0 2px 8px rgba(0,0,0,0.3)",
        }}
      >
        <span
          style={{
            fontFamily:
              "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
            fontWeight: 800,
            fontSize: 38,
            color: "#ffffff",
            letterSpacing: 0.5,
            textShadow: "0 2px 6px rgba(0,0,0,0.3)",
            whiteSpace: "nowrap",
          }}
        >
          {ctaText}
        </span>
      </div>
    </div>
  );
}

// ─── Main composition ──────────────────────────────────────────────────────
export const PostReel = ({
  mediaUrl,
  mediaType = "photo",
  caption = "",
  hashtags = [],
  cta = "",
  handle = "@handle",
  theme = "dark",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000000",
        fontFamily: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
      }}
    >
      {/* Background media */}
      {mediaType === "video" ? (
        <VideoBackground src={mediaUrl} />
      ) : (
        <KenBurnsPhoto src={mediaUrl} />
      )}

      {/* Gradient overlay for legibility */}
      <GradientOverlay />

      {/* Handle watermark at top */}
      <HandleWatermark handle={handle} />

      {/* Caption + hashtags */}
      <Sequence from={0} durationInFrames={durationInFrames}>
        <CaptionBlock
          caption={caption}
          hashtags={hashtags}
          fps={fps}
          frame={frame}
        />
      </Sequence>

      {/* CTA pill at bottom */}
      <Sequence from={0} durationInFrames={durationInFrames}>
        <CTAPill cta={cta} handle={handle} frame={frame} />
      </Sequence>
    </AbsoluteFill>
  );
};
