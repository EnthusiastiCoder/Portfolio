// Building blocks for kit artifact pages. A builder imports these, composes a page and writes
// info-server/artifacts/<id>.html. Every number and coordinate is computed from data here.

export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
