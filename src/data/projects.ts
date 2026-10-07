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
}

// Every claim below comes from the project's README (see each fact's `source`).
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
          detail: "The MODNet and U2-Net-P models are pinned in models.lock.json.",
          source: "Nopload README.md#Stack",
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
          detail: "npm run check:third-party scans the built site for any off-origin reference.",
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
    slug: "matrix-portfolio",
    title: "Matrix Portfolio",
    summary:
      "This site: a statically rendered Next.js portfolio where a red or blue pill choice switches it between a depth mode and a surface mode, with GitHub and LeetCode stats refreshed every six hours.",
    tech: ["Next.js", "TypeScript", "Tailwind CSS", "Zod", "Vitest"],
    date: "2026-11",
    featured: false,
  },
];
