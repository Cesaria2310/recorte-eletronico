import { Composition } from "remotion";
import { PostReel } from "./PostReel.jsx";

const defaultProps = {
  mediaUrl:
    "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1080&h=1920&fit=crop",
  mediaType: "photo",
  caption:
    "Aqui está o momento incrível que você não pode perder! Confira tudo que preparamos para vocês hoje. Vem com a gente nessa jornada incrível! ✨",
  hashtags: [
    "#reels",
    "#viral",
    "#instagood",
    "#brasil",
    "#photography",
    "#explore",
  ],
  cta: "Siga para mais conteúdo • Mande um Direct 📩",
  handle: "@recorteeletronico",
  theme: "dark",
  durationInFrames: 240,
};

export const RemotionRoot = () => {
  return (
    <Composition
      id="PostReel"
      component={PostReel}
      durationInFrames={defaultProps.durationInFrames}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={defaultProps}
    />
  );
};
