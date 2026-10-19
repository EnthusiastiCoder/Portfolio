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

	function openModal(id) {
		const src = document.getElementById(`m-${id}`);
		// The same modal twice in a row (double click, a node and a tile) would stack a copy of itself.
		if (stack.length && stack[stack.length - 1].dataset.modal === id) return;
		if (!src) return console.warn("kit: no modal", id);
		const wrap = el("div");
		wrap.style.display = "contents";
		for (const c of src.children) wrap.appendChild(c.cloneNode(true));
		// Wide dialogs only for wide content (side-by-side charts, tables, images, wide diagrams);
		// a single chart in a 1100px dialog is mostly empty space.
		const wide = wrap.querySelector(".kit-row, table, img, .kit-pages, svg.kit-flow-wide");
		openLayer(src.dataset.title || id, wrap, { medium: !wide });
		stack[stack.length - 1].dataset.modal = id;
	}
	function openTerm(key) {
		const t = glossary[key];
		if (!t) return;
		const body = el("div");
		if (t.visual) body.appendChild(el("div", "kit-visual", t.visual));
		body.appendChild(el("p", "kit-lead", defHtml(t.definition)));
		if (t.example) body.appendChild(el("p", "dim small", `<b>Example:</b> ${defHtml(t.example)}`));
		openLayer(t.label, body, { small: true });
	}

	// ── glossary terms + tooltip ────────────────────────────────────────────
	function showTip(target, key) {
		const t = glossary[key];
		if (!t) return;
		clearTimeout(tipTimer);
		hideTip(true);
		tip = el("div", "kit-tip", `<b>${esc(t.label)}</b>${defHtml(t.definition)}<span class="hint">Click the term for more · underlined words open their own definition</span>`);
		tip.setAttribute("role", "tooltip");
		tip.style.zIndex = String(1000 + stack.length * 10);
		document.body.appendChild(tip);
		const r = target.getBoundingClientRect();
		const w = tip.offsetWidth;
		const h = tip.offsetHeight;
		let left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
		let top = r.bottom + 6;
		if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
		tip.style.left = `${left}px`;
		tip.style.top = `${top}px`;
		tip.addEventListener("mouseenter", () => clearTimeout(tipTimer));
		tip.addEventListener("mouseleave", () => hideTip());
	}
	function hideTip(now) {
		clearTimeout(tipTimer);
		const go = () => {
			if (tip) tip.remove();
			tip = null;
		};
		if (now) go();
		else tipTimer = setTimeout(go, 300);
	}

	/** Marks the first use of each glossary label/alias inside `root` (skips headings' buttons, svg, existing terms). */
	function annotate(root) {
		const entries = [];
		for (const [key, t] of Object.entries(glossary)) {
			for (const name of [t.label, ...(t.aliases || [])]) entries.push([name, key]);
		}
		entries.sort((a, b) => b[0].length - a[0].length);
		const done = new Set([...root.querySelectorAll("[data-term]")].map((n) => n.dataset.term));
		for (const [name, key] of entries) {
			if (done.has(key)) continue;
			const re = new RegExp(`(^|[^\\p{L}\\p{N}_])(${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?=$|[^\\p{L}\\p{N}_])`, "iu");
			const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
				acceptNode: (n) =>
					n.parentElement.closest("[data-term],button,a,svg,script,style,.kit-no-annotate,h1,input,.kit-tip")
						? NodeFilter.FILTER_REJECT
						: NodeFilter.FILTER_ACCEPT,
			});
			for (let n = walker.nextNode(); n; n = walker.nextNode()) {
				const m = re.exec(n.nodeValue);
				if (!m) continue;
				const start = m.index + m[1].length;
				const after = n.splitText(start);
				after.splitText(m[2].length);
				const span = el("span", "kit-term");
				span.dataset.term = key;
				span.textContent = after.nodeValue;
				after.replaceWith(span);
				done.add(key);
				break;
			}
		}
		for (const n of root.querySelectorAll("[data-term]")) {
			n.classList.add("kit-term");
			n.tabIndex = 0;
			n.setAttribute("role", "button");
		}
	}

	/** Event wiring for triggers, terms and refs inside `root`. */
	function wire(root) {
		root.addEventListener("click", (e) => {
			const open = e.target.closest("[data-kit-open]");
			if (open) {
				e.preventDefault();
				hideTip(true);
				return openModal(open.dataset.kitOpen);
			}
			const ref = e.target.closest("[data-ref]");
			if (ref) {
				e.preventDefault();
				hideTip(true);
				return openTerm(ref.dataset.ref);
			}
			const term = e.target.closest("[data-term]");
			if (term) {
				e.preventDefault();
				hideTip(true);
				return openTerm(term.dataset.term);
			}
		});
		root.addEventListener("keydown", (e) => {
			const t = e.target.closest?.("[data-term],[data-kit-open]");
			if (t && (e.key === "Enter" || e.key === " ")) {
				e.preventDefault();
				t.click();
			}
		});
		root.addEventListener("mouseover", (e) => {
			const t = e.target.closest?.("[data-term]");
			if (t && (!tip || tip.dataset.for !== t.dataset.term)) {
				showTip(t, t.dataset.term);
				if (tip) tip.dataset.for = t.dataset.term;
			}
		});
		root.addEventListener("mouseout", (e) => {
			if (e.target.closest?.("[data-term]")) hideTip();
		});
		root.addEventListener("focusin", (e) => {
			const t = e.target.closest?.("[data-term]");
			if (t) showTip(t, t.dataset.term);
		});
	}
