import { projectLinks } from "@/config/project-links";

export interface Screenshot {
  /** Starts with `/projects/<slug>/`; the file lives under `public/`. */
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface DepthFact {
  label: string;
  detail: string;
  /** Where the claim comes from, for example `"Nopload README.md#Features"`. */
  source: string;
}

export interface ProjectDepth {
  architecture: string[];
  tradeoffs: string[];
  facts: DepthFact[];
}

export interface DiagramNode {
  id: string;
  label: string;
  /** Position on a 0-100 grid. */
  x: number;
  y: number;
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
}

export interface Diagram {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

export interface HardProblem {
  problem: string;
  approach: string;
  /** The file the problem and approach come from. */
  source: string;
}

export interface PerfFact {
  label: string;
  value: string;
  /** The file the number comes from. */
  source: string;
}

export interface Cta {
  label: string;
  href: string;
}

export interface Project {
  /** Kebab-case slug; matches `src/content/projects/<slug>.mdx`. */
  slug: string;
  title: string;
  summary: string;
  tech: string[];
  /** Month of the last commit in the project's repo, `YYYY-MM`. */
  date: string;
  featured: boolean;
  repo?: string;
  demo?: string;
  tagline?: string;
  highlights?: string[];
  screenshots?: Screenshot[];
  depth?: ProjectDepth;
  // Blue: presentation, UI and human understanding.
  /** Who it helps, one sentence. */
  audience: string;
  /** What it does for you, in plain language. */
  story: string;
  /** 2-4 UI and design notes. */
  design: string[];
  /** The main button: the live product. */
  primaryCta: Cta;
  // Red: technical depth and engineering.
  diagram: Diagram;
  hardProblems: HardProblem[];
  /** Sourced numbers only; empty when none exists. */
  perf: PerfFact[];
  stack: string[];
}

/** The live URL from `src/config/project-links.ts`; every product has one. */
function liveUrl(slug: string): string {
  const entry = projectLinks[slug];
  if (entry?.state !== "live") throw new Error(`No live link for ${slug}`);
  return entry.url;
}

// Every claim below comes from the project's README (see each `source`).
// Order: the showcase order used by getAllProjects().
export const projects: Project[] = [
  {
    slug: "nopload",
    title: "Nopload",
    summary:
      "A free, ad-free image suite where every byte is processed in your browser: remove backgrounds, compress, convert, resize, turn HEIC into JPG and strip EXIF.",
    tagline: "Edit images without uploading them.",
    highlights: [
      "Background removal at full resolution on WebGPU, with a WASM fallback",
      "A header badge lists every network request the page has made",
      "Works offline after the first visit as an installable PWA",
    ],
    tech: ["Astro", "Preact", "Tailwind CSS", "onnxruntime-web", "Web Workers", "Playwright"],
    date: "2026-11",
    featured: true,
    repo: "https://github.com/EnthusiastiCoder/Nopload",
    audience:
      "Anyone who needs to edit a photo and would rather not hand it to an upload site, an account or a credit system.",
    story:
      "Drop a photo and Nopload removes its background, shrinks it, converts it, resizes it or strips its location data, all inside your browser. Your image never leaves your device, and after the first visit it even works offline.",
    design: [
      "Drop files anywhere on the home page and it asks what to do with them.",
      'Every result offers a next step, for example "Next: compress it".',
      'A "0 uploads" badge in the header opens a list of every request the page has made.',
      "Light and dark themes, keyboard accessible, and audited on a 360 px phone.",
    ],
    primaryCta: { label: "Open Nopload", href: liveUrl("nopload") },
    diagram: {
      nodes: [
        { id: "page", label: "Astro page, Preact islands", x: 10, y: 15 },
        { id: "workers", label: "Comlink Web Workers", x: 50, y: 15 },
        { id: "codecs", label: "jSquash codecs, libheif-js", x: 90, y: 15 },
        { id: "ort", label: "onnxruntime-web (WebGPU or WASM)", x: 50, y: 55 },
        { id: "models", label: "MODNet, U2-Net-P from /models/", x: 90, y: 55 },
        { id: "sw", label: "Workbox service worker", x: 10, y: 55 },
        { id: "csp", label: "CSP connect-src 'self'", x: 30, y: 90 },
      ],
      edges: [
        { from: "page", to: "workers", label: "files" },
        { from: "workers", to: "codecs", label: "encode" },
        { from: "page", to: "ort", label: "remove background" },
        { from: "ort", to: "models", label: "pinned models" },
        { from: "sw", to: "page", label: "offline" },
        { from: "csp", to: "page", label: "no other origin" },
      ],
    },
    hardProblems: [
      {
        problem: "Prove that images are never uploaded, instead of asking to be trusted.",
        approach:
          "Every page is served with a CSP of connect-src 'self', a header badge lists every request, and the e2e suite fails if any request leaves the site's origin on any page, during model load and inference, or offline.",
        source: "Nopload README.md#How privacy is verifiable",
      },
      {
        problem: "Remove backgrounds at full resolution with no server.",
        approach:
          "MODNet and U2-Net-P, pinned in a models lock file, run through onnxruntime-web on WebGPU when available and on the CPU with WASM otherwise.",
        source: "Nopload README.md#Features, #Stack",
      },
      {
        problem: "Hand files from one tool to the next without leaving copies behind.",
        approach:
          "An end-to-end test checks that files handed between tools are deleted from IndexedDB on pickup.",
        source: "Nopload README.md#How privacy is verifiable",
      },
    ],
    perf: [
      {
        label: "Third-party requests",
        value: "0",
        source: "Nopload README.md#How privacy is verifiable",
      },
      { label: "Phone width audited", value: "360 px", source: "Nopload README.md#Local development" },
    ],
    stack: [
      "Astro 7",
      "Preact",
      "Tailwind CSS 4",
      "onnxruntime-web",
      "jSquash",
      "libheif-js",
      "exifr",
      "fflate",
      "Comlink",
      "Workbox",
      "Vitest",
      "Playwright",
      "Cloudflare Pages",
    ],
    screenshots: [
      {
        src: "/projects/nopload/home-dark-desktop.png",
        alt: "Nopload home page, dark theme, desktop",
        width: 1280,
        height: 800,
      },
      {
        src: "/projects/nopload/remove-background-dark-desktop.png",
        alt: "Background removed from a portrait, dark theme, desktop",
        width: 1280,
        height: 800,
      },
    ],
    depth: {
      architecture: [
        "Static, prerendered Astro pages with Preact islands.",
        "MODNet and U2-Net-P run through onnxruntime-web on WebGPU, or WASM on the CPU.",
        "Image codecs (MozJPEG, OxiPNG, WebP, AVIF, JXL) and libheif-js for HEIC run in Comlink Web Workers.",
        "A Workbox service worker makes the tools work offline after the first visit.",
      ],
      tradeoffs: [
        "No server means no upload, but the model and codecs ship to the browser and are cached for offline use.",
        "WebGPU is used when available; the CPU WASM path is the fallback.",
      ],
      facts: [
        {
          label: "Enforced privacy",
          detail:
            "Every page is served with a Content-Security-Policy that sets connect-src 'self', so the page cannot send images to another origin.",
          source: "Nopload README.md#How privacy is verifiable",
        },
        {
          label: "Tests for the claim",
          detail:
            "The e2e suite fails if any request leaves the site's own origin on any page, during model load and inference, or offline.",
          source: "Nopload README.md#How privacy is verifiable",
        },
        {
          label: "Pinned models",
          detail: "The MODNet and U2-Net-P models are pinned in a models lock file.",
          source: "Nopload README.md#Stack",
        },
      ],
    },
  },
  {
    slug: "foreverqr",
    title: "ForeverQR",
    summary:
      "A free QR code studio that makes codes that never expire, plus a checker that tells you whether someone else's code will. Everything runs in your browser.",
    tagline: "QR codes that never expire.",
    highlights: [
      "Static codes for URL, WiFi, vCard, Email, SMS, Location, Event and Text",
      "A live scan check decodes the code again to prove it reads",
      "An expiry checker for codes made by others",
    ],
    tech: ["Astro", "Svelte", "Tailwind CSS", "zxing-wasm", "pdf-lib"],
    date: "2026-02",
    featured: true,
    repo: "https://github.com/EnthusiastiCoder/ForeverQR",
    audience:
      "People who print a QR code on a menu, flyer or card and need it to keep working, and anyone wondering whether a code they were given will.",
    story:
      "Make a QR code for a link, a WiFi network, a contact card or an event, style it and download it. The codes are static, so they never expire. You can also check a code someone else made to see whether it might stop working.",
    design: [
      "Colours, gradients, dot and eye styles, frames, logo upload and presets.",
      "A live scan check reads the code back, so you know it works before you use it.",
      "Export as SVG, PNG or PDF.",
      "A footer meter shows the same request count you would see in DevTools.",
    ],
    primaryCta: { label: "Open ForeverQR", href: liveUrl("foreverqr") },
    diagram: {
      nodes: [
        { id: "studio", label: "Studio, Svelte 5 island", x: 10, y: 20 },
        { id: "gen", label: "qrcode-generator", x: 50, y: 10 },
        { id: "zxing", label: "zxing-wasm decoder", x: 90, y: 30 },
        { id: "export", label: "pdf-lib, opentype.js export", x: 50, y: 50 },
        { id: "checker", label: "Expiry checker", x: 90, y: 75 },
        { id: "store", label: "localStorage fqr:v1", x: 10, y: 65 },
        { id: "pwa", label: "@vite-pwa/astro offline", x: 40, y: 92 },
      ],
      edges: [
        { from: "studio", to: "gen", label: "draw" },
        { from: "gen", to: "zxing", label: "live scan check" },
        { from: "studio", to: "export", label: "SVG, PNG, PDF" },
        { from: "checker", to: "zxing", label: "decode" },
        { from: "studio", to: "store", label: "settings" },
        { from: "pwa", to: "studio", label: "offline" },
      ],
    },
    hardProblems: [
      {
        problem: "Make codes that never expire.",
        approach:
          "Only static codes are made, so a code never depends on a server that could expire.",
        source: "ForeverQR README.md#Features",
      },
      {
        problem: "Prove a heavily styled code still scans.",
        approach: "A live scan check decodes the code again with zxing-wasm to prove it reads.",
        source: "ForeverQR README.md#Features, #Stack",
      },
      {
        problem: "Tell whether someone else's code will expire.",
        approach:
          "The expiry checker takes an uploaded, pasted or scanned code and classifies it as static, direct, dynamic or behind a shortener.",
        source: "ForeverQR README.md#Features",
      },
    ],
    perf: [
      {
        label: "Third-party requests",
        value: "0",
        source: "ForeverQR README.md#Privacy promise",
      },
      { label: "Code types", value: "8", source: "ForeverQR README.md#Features" },
      { label: "Export formats", value: "3", source: "ForeverQR README.md#Features" },
      { label: "SEO landing pages", value: "11", source: "ForeverQR README.md#Features" },
    ],
    stack: [
      "Astro",
      "Svelte 5",
      "Tailwind CSS 4",
      "qrcode-generator",
      "zxing-wasm",
      "pdf-lib",
      "opentype.js",
      "@vite-pwa/astro",
    ],
    screenshots: [
      {
        src: "/projects/foreverqr/home.png",
        alt: "ForeverQR social card for the QR studio",
        width: 1200,
        height: 630,
      },
    ],
    depth: {
      architecture: [
        "Astro with Svelte 5 islands and Tailwind CSS 4.",
        "qrcode-generator draws the codes; zxing-wasm decodes them for the live scan check and the checker.",
        "Export to SVG, PNG and PDF uses pdf-lib and opentype.js.",
        "Settings stay in localStorage (key fqr:v1); the app is installable and works offline.",
      ],
      tradeoffs: [
        "Only static codes are made, so a code never depends on a server that could expire.",
        "No back end means no analytics and no scan tracking.",
      ],
      facts: [
        {
          label: "Landing pages",
          detail: "11 SEO landing pages, a sitemap and FAQ structured data.",
          source: "ForeverQR README.md#Features",
        },
        {
          label: "Enforced privacy",
          detail:
            "A Content Security Policy with connect-src 'self' enforces the no-third-party promise.",
          source: "ForeverQR README.md#Privacy promise",
        },
        {
          label: "Expiry checker",
          detail:
            "Classifies an uploaded, pasted or scanned code as static, direct, dynamic or behind a shortener.",
          source: "ForeverQR README.md#Features",
        },
      ],
    },
  },
  {
    slug: "quietpdf",
    title: "QuietPDF",
    summary:
      "Free PDF tools that run entirely in your browser: merge, split, compress, sign, redact, OCR and more, with nothing uploaded, no accounts, no ads and no analytics.",
    tagline: "PDF tools where your files never leave your device.",
    highlights: [
      "Merge, split, compress, sign, protect, unlock and true redaction",
      "OCR in English and Hindi",
      "A privacy meter counts third-party requests live",
    ],
    tech: ["pdf.js", "qpdf", "Tesseract", "TypeScript", "Playwright"],
    date: "2026-10",
    featured: true,
    repo: "https://github.com/EnthusiastiCoder/QuietPDF",
    audience:
      "Anyone who has to merge, sign, redact or OCR a PDF and would rather not upload it anywhere.",
    story:
      "Pick a PDF tool, add your file and get the result back, without anything being uploaded. There are no accounts, no ads, no analytics and no cookies, and after the first visit it works offline.",
    design: [
      "A privacy meter at the bottom of every page counts third-party requests and uploaded bytes live.",
      "One tool per job: merge, split, compress, sign, protect, unlock, true redaction and more.",
      "OCR reads English and Hindi.",
    ],
    primaryCta: { label: "Open QuietPDF", href: liveUrl("quietpdf") },
    diagram: {
      nodes: [
        { id: "tools", label: "Tool pages", x: 10, y: 20 },
        { id: "pdfjs", label: "pdf.js (self-hosted)", x: 50, y: 10 },
        { id: "qpdf", label: "qpdf (self-hosted)", x: 90, y: 10 },
        { id: "ocr", label: "Tesseract OCR", x: 50, y: 50 },
        { id: "lang", label: "OCR language data, same origin", x: 90, y: 50 },
        { id: "meter", label: "Privacy meter", x: 10, y: 60 },
        { id: "sw", label: "Service worker (PWA)", x: 30, y: 92 },
      ],
      edges: [
        { from: "tools", to: "pdfjs" },
        { from: "tools", to: "qpdf" },
        { from: "tools", to: "ocr", label: "OCR" },
        { from: "ocr", to: "lang", label: "first use" },
        { from: "meter", to: "tools", label: "counts requests" },
        { from: "sw", to: "tools", label: "offline" },
      ],
    },
    hardProblems: [
      {
        problem: "Prove that files never leave the device.",
        approach:
          "A strict CSP (connect-src 'self', script-src 'self') forbids requests to any other origin, and a meter on every page counts third-party requests and uploaded bytes live.",
        source: "QuietPDF README.md#The privacy proof",
      },
      {
        problem: "Run heavy PDF and OCR engines without a CDN.",
        approach:
          "pdf.js, qpdf, Tesseract and every font are self-hosted, and OCR fetches its language data from the site's own origin on first use.",
        source: "QuietPDF README.md#The privacy proof",
      },
      {
        problem: "Catch an off-origin reference before it ships.",
        approach: "A third-party check script scans the built site for any off-origin reference.",
        source: "QuietPDF README.md#The privacy proof",
      },
    ],
    perf: [
      {
        label: "Third-party requests on the meter",
        value: "0",
        source: "QuietPDF README.md#The privacy proof",
      },
      {
        label: "Uploaded bytes on the meter",
        value: "0",
        source: "QuietPDF README.md#The privacy proof",
      },
      { label: "Tools", value: "15", source: "QuietPDF README.md#Tools" },
      { label: "OCR languages", value: "2", source: "QuietPDF README.md#Tools" },
    ],
    stack: ["pdf.js", "qpdf", "Tesseract", "TypeScript", "Service worker (PWA)", "Vitest", "Playwright"],
    screenshots: [
      {
        src: "/projects/quietpdf/home.png",
        alt: "QuietPDF home page",
        width: 1280,
        height: 800,
      },
      {
        src: "/projects/quietpdf/merge-pdf.png",
        alt: "QuietPDF merge PDF tool",
        width: 1280,
        height: 800,
      },
      {
        src: "/projects/quietpdf/privacy.png",
        alt: "QuietPDF privacy page",
        width: 1280,
        height: 800,
      },
    ],
    depth: {
      architecture: [
        "pdf.js, qpdf and Tesseract engines and every font are self-hosted, so nothing loads from a CDN.",
        "A strict Content-Security-Policy forbids requests to any other origin.",
        "OCR fetches its language data from the site's own origin on first use.",
        "A service worker makes the app work offline after the first visit (PWA).",
      ],
      tradeoffs: [
        "Self-hosting every engine and font keeps the privacy proof simple, at the cost of shipping them with the site.",
        "OCR language data is fetched on first use rather than bundled up front.",
      ],
      facts: [
        {
          label: "CSP",
          detail: "connect-src 'self' and script-src 'self' forbid requests to any other origin.",
          source: "QuietPDF README.md#The privacy proof",
        },
        {
          label: "Built-site scan",
          detail: "A third-party check script scans the built site for any off-origin reference.",
          source: "QuietPDF README.md#The privacy proof",
        },
        {
          label: "OCR languages",
          detail: "OCR supports English and Hindi.",
          source: "QuietPDF README.md#Tools",
        },
      ],
    },
  },
  {
    slug: "framelab",
    title: "Framelab",
    summary:
      "Free video and audio tools that run entirely in your browser with WebCodecs: compress, convert, trim, resize, extract audio and add subtitles, with no upload and no watermark.",
    tagline: "Video and audio tools that never upload your media.",
    highlights: [
      "Tool pages for video, audio and subtitles, each with the tool above the fold",
      "Auto subtitles use Whisper speech recognition on your device",
      "Files move between tools inside your browser",
    ],
    tech: ["Astro", "Svelte", "TypeScript", "Mediabunny", "WebCodecs", "Playwright"],
    date: "2026-11",
    featured: true,
    repo: "https://github.com/EnthusiastiCoder/framelab",
    audience:
      "People who need to trim, shrink or subtitle a clip and do not want a watermark, a sign-up or an upload.",
    story:
      "Open a tool, drop in a video or audio file and get the result back: compress it, trim it, turn it into a GIF, pull out the audio or add subtitles. Everything happens on your device, with no watermark and no limits.",
    design: [
      'Each tool sits above the fold, with "Try a sample file" in every empty tool.',
      "A before and after size and length summary follows each export.",
      '"Use the result in another tool" moves the file between tools inside your browser.',
      "A keyboard shortcuts sheet, light and dark themes, and a reduced-motion path.",
    ],
    primaryCta: { label: "Open Framelab", href: liveUrl("framelab") },
    diagram: {
      nodes: [
        { id: "page", label: "Tool page, Svelte 5 island", x: 10, y: 20 },
        { id: "worker", label: "Dedicated module worker", x: 50, y: 20 },
        { id: "codec", label: "Mediabunny, WebCodecs", x: 90, y: 20 },
        { id: "speech", label: "transformers.js, ONNX Runtime Web", x: 50, y: 60 },
        { id: "models", label: "Whisper model, own origin", x: 90, y: 60 },
        { id: "handoff", label: "IndexedDB hand-off", x: 10, y: 60 },
        { id: "sw", label: "Hand-written service worker", x: 30, y: 92 },
      ],
      edges: [
        { from: "page", to: "worker", label: "file" },
        { from: "worker", to: "codec", label: "decode, edit, encode" },
        { from: "page", to: "speech", label: "auto subtitles" },
        { from: "speech", to: "models", label: "after consent" },
        { from: "page", to: "handoff", label: "next tool" },
        { from: "sw", to: "page", label: "offline" },
      ],
    },
    hardProblems: [
      {
        problem: "Edit video with no upload endpoint at all.",
        approach:
          "Every tool decodes, edits and encodes inside the page, in a dedicated module worker, with Mediabunny and WebCodecs.",
        source: "Framelab README.md#Privacy model, #Stack",
      },
      {
        problem: "Speech models are large downloads.",
        approach:
          "Auto subtitles downloads a Whisper model only after the user accepts its size; models come from Framelab's own origin and the offline cache never includes them.",
        source: "Framelab README.md#Privacy model",
      },
      {
        problem: "Codec support differs between browsers.",
        approach:
          "Edge and Chrome use their H.264/AAC encoders for MP4, bundled Chromium offers WebM with a reason, and browsers without WebCodecs get a clear notice.",
        source: "Framelab README.md#Browser support",
      },
    ],
    perf: [
      { label: "Tool pages", value: "17", source: "Framelab README.md#What it does" },
      {
        label: "Cross-origin requests, asserted by e2e",
        value: "0",
        source: "Framelab README.md#Privacy model",
      },
      {
        label: "Playwright browser projects measured",
        value: "4",
        source: "Framelab README.md#Browser support",
      },
    ],
    stack: [
      "Astro 5",
      "Svelte 5",
      "TypeScript (strict)",
      "Mediabunny",
      "WebCodecs",
      "transformers.js",
      "ONNX Runtime Web",
      "Vitest",
      "Playwright",
      "Cloudflare Pages",
    ],
    screenshots: [
      {
        src: "/projects/framelab/home-light.png",
        alt: "Framelab home page, light theme",
        width: 1280,
        height: 800,
      },
      {
        src: "/projects/framelab/trim-video-dark.png",
        alt: "Trim video tool in dark mode",
        width: 1280,
        height: 800,
      },
      {
        src: "/projects/framelab/compress-video-light.png",
        alt: "Compress video tool, light theme",
        width: 1280,
        height: 800,
      },
    ],
    depth: {
      architecture: [
        "Astro static output with Svelte 5 islands and strict TypeScript.",
        "Every tool decodes, edits and encodes in a dedicated module worker through Mediabunny and WebCodecs.",
        "Speech recognition uses transformers.js and ONNX Runtime Web.",
        "A hand-written service worker and sitemap endpoint, with COOP/COEP and a strict hash-based CSP in public/_headers.",
      ],
      tradeoffs: [
        "Speech models download only after the user accepts their size, and the offline cache never includes them.",
        "Browsers without WebCodecs get a clear notice instead of a degraded tool.",
        "Bundled Chromium offers WebM with a reason, because MP4 needs the H.264/AAC encoders in Edge and Chrome.",
      ],
      facts: [
        {
          label: "Tool pages",
          detail: "17 tool pages across video, audio and subtitles.",
          source: "Framelab README.md#What it does",
        },
        {
          label: "Network proof",
          detail:
            "The e2e suite asserts 0 cross-origin requests on every page and after a tool flow.",
          source: "Framelab README.md#Privacy model",
        },
        {
          label: "Measured browser support",
          detail:
            "WebKit on Windows has no WebCodecs in Playwright's build, so the mute flow shows the not-supported notice there. Real Safari was not measured.",
          source: "Framelab README.md#Browser support",
        },
      ],
    },
  },
  {
    slug: "syncplay",
    title: "SyncPlay",
    summary:
      "A Windows desktop music player with a transparent, word-level synchronized lyric overlay, theme customization and offline forced-alignment tools.",
    tagline: "A music player with a word-by-word lyric overlay.",
    highlights: [
      "Always-on-top overlay that highlights the current word",
      "Offline forced alignment with stable-ts (Whisper), with optional GPU acceleration",
      "6 built-in themes plus custom themes with live preview",
    ],
    tech: ["Python", "PyQt", "QMediaPlayer", "mutagen", "stable-ts", "PyInstaller"],
    date: "2026-11",
    featured: true,
    repo: "https://github.com/EnthusiastiCoder/SyncPlay",
    audience:
      "Windows listeners who want to sing along to their own music, word by word.",
    story:
      "Play your own music and the lyrics float over your desktop, lighting up word by word as they are sung. If a song has no timed lyrics, SyncPlay can line the words up with the audio for you, offline, and save them inside the MP3.",
    design: [
      "The overlay sizes itself to the longest line and fades out after 5 seconds of pause.",
      "6 built-in themes plus custom themes, with a live preview on the overlay.",
      "Keyboard shortcuts for play, open file, the overlay and settings.",
      "Minimizes to the system tray, with playback controls in the tray menu.",
    ],
    primaryCta: { label: "Get SyncPlay", href: liveUrl("syncplay") },
    diagram: {
      nodes: [
        { id: "engine", label: "QMediaPlayer engine", x: 10, y: 15 },
        { id: "clock", label: "30 Hz playback clock", x: 50, y: 15 },
        { id: "renderer", label: "QPainter lyric renderer", x: 90, y: 15 },
        { id: "overlay", label: "Transparent overlay (Win32)", x: 90, y: 55 },
        { id: "wlrc", label: "WLRC in MP3 ID3 tag", x: 50, y: 55 },
        { id: "aligner", label: "stable-ts alignment worker", x: 10, y: 55 },
        { id: "models", label: "Whisper model cache", x: 10, y: 92 },
      ],
      edges: [
        { from: "engine", to: "clock", label: "position" },
        { from: "clock", to: "renderer", label: "current word" },
        { from: "wlrc", to: "renderer", label: "word timings" },
        { from: "renderer", to: "overlay", label: "draw" },
        { from: "aligner", to: "wlrc", label: "auto-embed" },
        { from: "models", to: "aligner" },
      ],
    },
    hardProblems: [
      {
        problem: "Highlight the exact word being sung.",
        approach:
          "Word-level timestamps live in .wlrc, a custom JSON format, looked up by binary search against a 30 Hz playback clock and drawn with QPainter.",
        source: "SyncPlay README.md#WLRC Format, #Project Structure",
      },
      {
        problem: "Get word timings without typing them by hand.",
        approach:
          "An offline stable-ts (Whisper) forced-alignment worker, with optional CUDA, aligns the transcript to the audio and embeds the result into the MP3 (TXXX:WLRC) with mutagen.",
        source: "SyncPlay README.md#Features, #Project Structure",
      },
      {
        problem: "An overlay that stays on top without getting in the way.",
        approach:
          "A transparent, always-on-top window that is click-through by default; holding for 300 ms enters drag mode, and a grip resizes it.",
        source: "SyncPlay README.md#Overlay Usage",
      },
    ],
    perf: [
      { label: "Playback clock", value: "30 Hz", source: "SyncPlay README.md#Project Structure" },
      {
        label: "Unit tests passing",
        value: "118",
        source: "SyncPlay README.md#Project Structure",
      },
      { label: "Hold to drag", value: "300 ms", source: "SyncPlay README.md#Overlay Usage" },
      { label: "Alignment languages", value: "99+", source: "SyncPlay README.md#Features" },
    ],
    stack: ["Python 3.11+", "PyQt", "QMediaPlayer", "mutagen", "stable-ts", "pytest", "PyInstaller"],
    depth: {
      architecture: [
        "QMediaPlayer audio engine driven by a 30 Hz playback clock.",
        "A custom .wlrc JSON format holds word-level timestamps, embedded in MP3 ID3 tags (TXXX:WLRC) with mutagen.",
        "The overlay is a transparent window with Win32 drag and resize, and QPainter renders each word.",
        "An alignment worker runs stable-ts forced alignment and embeds the result back into the MP3.",
      ],
      tradeoffs: [
        "Windows 10/11 only, in exchange for Win32 overlay behaviours such as click-through.",
        "The audio visualizer animates decorative bars and is not driven by the audio spectrum yet.",
      ],
      facts: [
        {
          label: "Tests",
          detail: "118 unit tests, all passing.",
          source: "SyncPlay README.md#Project Structure",
        },
        {
          label: "Drag gesture",
          detail: "The overlay is click-through by default; holding for 300ms enters drag mode.",
          source: "SyncPlay README.md#Overlay Usage",
        },
        {
          label: "Alignment languages",
          detail: "Whisper-based alignment supports 99+ languages.",
          source: "SyncPlay README.md#Features",
        },
      ],
    },
  },
];
