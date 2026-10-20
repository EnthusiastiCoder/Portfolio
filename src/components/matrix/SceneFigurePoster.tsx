/**
 * The hero portrait as a plain image: the same keyed figure the 3D scene
 * displaces, with fixed width and height so it adds no layout shift. It is the
 * poster of the 3D scene: shown until WebGL draws its first frame, and kept
 * when WebGL is unavailable. It also carries the scene's text alternative,
 * since the canvas itself is aria-hidden.
 */
export default function SceneFigurePoster() {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a fixed-size poster under a canvas; next/image adds a wrapper and JS.
    <img
      className="scene-svg"
      src="/hero/figure.webp"
      width={400}
      height={480}
      alt="A portrait of Arpan Mandal in a black suit and long black coat, holding out a red pill and a blue pill"
      decoding="async"
      style={{
        objectFit: "contain",
        WebkitMaskImage: "linear-gradient(to bottom, #000 62%, transparent 92%)",
        maskImage: "linear-gradient(to bottom, #000 62%, transparent 92%)",
      }}
    />
  );
}
