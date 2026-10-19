// Info-server kit: stacked modals, glossary tooltips, nested term modals, live reload. No dependencies.
//
// Authoring contract (see INFO-SERVER.md):
//   <section class="kit-modal-src" id="m-<id>" data-title="…" hidden> … </section>   a modal's content
//   <button data-kit-open="<id>"> / <g class="kit-node" data-kit-open="<id>">        opens it (stacked)
//   <span data-term="<key>">text</span>                                             an explicit term
// Every glossary label/alias is also marked automatically on its first use in each view.
// A definition's [[key]] renders underlined; clicking it opens that term's modal on top.
// Esc or browser Back closes only the top modal.
(() => {
	const stack = [];
	let glossary = {};
	let tip = null;
	let tipTimer = 0;
	let markReady;
	const ready = new Promise((r) => {
		markReady = r;
	});

	const el = (tag, cls, html) => {
		const e = document.createElement(tag);
		if (cls) e.className = cls;
		if (html != null) e.innerHTML = html;
		return e;
	};
	const esc = (s) => String(s).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
	const defHtml = (def) =>
		esc(def).replace(/\[\[([a-z0-9_-]+)(?:\|([^\]]+))?\]\]/g, (_, k, label) => {
			const t = glossary[k];
			return `<button class="kit-ref" data-ref="${k}">${esc(label || (t ? t.label : k))}</button>`;
		});
