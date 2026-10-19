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

	// ── modals ──────────────────────────────────────────────────────────────
	function openLayer(title, bodyNode, opts = {}) {
		stack.forEach((l) => l.classList.add("under"));
		const layer = el("div", "kit-layer");
		layer.style.zIndex = String(100 + stack.length * 10);
		const dialog = el("div", `kit-dialog${opts.small ? " small" : opts.medium ? " medium" : ""}`);
		dialog.setAttribute("role", "dialog");
		dialog.setAttribute("aria-modal", "true");
		const crumbs = stack.map((l) => l.dataset.title).join(" › ");
		const head = el("header", null, `<div>${crumbs ? `<div class="crumb">${esc(crumbs)} ›</div>` : ""}<h2>${esc(title)}</h2></div>`);
		const close = el("button", "kit-close", "Close ✕");
		close.addEventListener("click", () => history.back());
		head.appendChild(close);
		const body = el("div", "body");
		body.appendChild(bodyNode);
		dialog.append(head, body);
		layer.appendChild(dialog);
		layer.dataset.title = title;
		layer.addEventListener("click", (e) => {
			if (e.target === layer) history.back();
		});
		document.body.appendChild(layer);
		stack.push(layer);
		history.pushState({ kitDepth: stack.length }, "");
		annotate(body);
		close.focus();
	}
	function closeTop() {
		const l = stack.pop();
		if (l) l.remove();
		if (stack.length) stack[stack.length - 1].classList.remove("under");
		hideTip(true);
	}
	window.addEventListener("popstate", () => closeTop());
	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape" && stack.length) {
			e.preventDefault();
			history.back();
		}
	});
