// VISUAL check of the info server: opens every deliverable in a real (headless) browser and
// checks what a person would SEE — not just that files exist (that is check.ts).
// Run: bun tools/info-server/visual-check.ts      (server must be up; exit 1 on any failure)
//
// Viewports: PRIMARY is Arpan's real screen (1529×837 CSS px at 125% scaling); every check runs
// there first, then at 1280×720, 1440×900, 1920×1080, and a 412-wide phone.
//
//   home     no page scroll, every artifact reachable in the paged library
//   kit      the answer is on the first screen, an illustration is drawn, terms are marked, a hover
//            shows a definition, an underlined word opens a stacked modal, EVERY modal opens with a
//            drawn visual and fits on screen
//   legacy   the framed page loads and shows real content
//
