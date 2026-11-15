import PillChoice from "@/components/matrix/PillChoice";
import { profile } from "@/data/profile";

const NAME_CLASS = "text-4xl font-bold leading-tight sm:text-6xl";

/** Terminal-style hero. The h1 is real SSR text at full opacity; effects only use aria-hidden copies. */
export default function Hero() {
  return (
    <section id="top" aria-labelledby="hero-title" className="panel p-6 sm:p-10">
      <p className="text-muted text-sm" aria-hidden="true">
        <span className="text-accent">&gt;</span> whoami
      </p>
      <div id="hero-name" className="glitch mt-3">
        <h1 id="hero-title" className={`${NAME_CLASS} text-accent text-glow`}>
          {profile.name}
          <span className="caret" aria-hidden="true" />
        </h1>
        <span className={`glitch-layer glitch-layer--r ${NAME_CLASS}`} aria-hidden="true">
          {profile.name}
        </span>
        <span className={`glitch-layer glitch-layer--b ${NAME_CLASS}`} aria-hidden="true">
          {profile.name}
        </span>
      </div>
      <p className="text-ink mt-4 text-lg">
        {profile.role} <span className="text-muted">· {profile.location}</span>
      </p>
      <p className="text-muted mt-2 max-w-2xl">{profile.tagline}</p>
      <PillChoice />
    </section>
  );
}
