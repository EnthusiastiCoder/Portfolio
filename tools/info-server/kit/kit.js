// Info-server kit: stacked modals, glossary tooltips, nested term modals, live reload. No dependencies.
//
// Authoring contract (see INFO-SERVER.md):
//   <section class="kit-modal-src" id="m-<id>" data-title="…" hidden> … </section>   a modal's content
//   <button data-kit-open="<id>"> / <g class="kit-node" data-kit-open="<id>">        opens it (stacked)
//   <span data-term="<key>">text</span>                                             an explicit term
//   <div class="kit-gallery"><button data-kit-zoom="<i>"><img …></button>…</div>    click-to-zoom images
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
	// openLayer is public (window.kit.openLayer): home's task map and the gallery lightbox stack with
	// every other modal, close with Esc or Back, and hand focus back to what opened them.
	//   opts.small | opts.medium   narrower dialogs
	//   opts.cls                   extra class(es) on the dialog (it then sizes itself)
	//   opts.head                  a node placed in the header, before Close (e.g. a view toggle)
	//   opts.onClose               called after the layer is removed
	//   opts.returnFocus           an element, or a function returning one; default: what had focus
	// Dialogs are centred (a modal pinned to the top reads as a page); home's library keeps its own layer.
	function openLayer(title, bodyNode, opts = {}) {
		const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		stack.forEach((l) => l.classList.add("under"));
		const layer = el("div", "kit-layer");
		layer.style.zIndex = String(100 + stack.length * 10);
		const dialog = el("div", `kit-dialog${opts.small ? " small" : opts.medium ? " medium" : ""}${opts.cls ? ` ${opts.cls}` : ""}`);
		dialog.setAttribute("role", "dialog");
		dialog.setAttribute("aria-modal", "true");
		dialog.setAttribute("aria-label", title);
		const crumbs = stack.map((l) => l.dataset.title).join(" › ");
		const head = el("header", null, `<div class="kit-head-title">${crumbs ? `<div class="crumb">${esc(crumbs)} ›</div>` : ""}<h2>${esc(title)}</h2></div>`);
		const close = el("button", "kit-close", "Close ✕");
		close.setAttribute("aria-label", `Close ${title}`);
		close.addEventListener("click", () => history.back());
		if (opts.head) head.appendChild(opts.head);
		head.appendChild(close);
		const body = el("div", "body");
		body.appendChild(bodyNode);
		dialog.append(head, body);
		layer.appendChild(dialog);
		layer.dataset.title = title;
		layer.addEventListener("click", (e) => {
			if (e.target === layer) history.back();
		});
		layer._kit = { onClose: opts.onClose, returnFocus: opts.returnFocus ?? opener };
		document.body.appendChild(layer);
		stack.push(layer);
		history.pushState({ kitDepth: stack.length }, "");
		annotate(body);
		balance(body);
		close.focus();
		return layer;
	}
	function closeTop() {
		const l = stack.pop();
		if (l) l.remove();
		if (stack.length) stack[stack.length - 1].classList.remove("under");
		hideTip(true);
		if (!l) return;
		const k = l._kit || {};
		try {
			k.onClose?.();
		} catch (e) {
			console.warn("kit: onClose", e);
		}
		const back = typeof k.returnFocus === "function" ? k.returnFocus() : k.returnFocus;
		if (back && back.isConnected) setTimeout(() => back.focus({ preventScroll: true }), 0);
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
	// ── gallery: a grid of thumbnails, click one to zoom it ─────────────────
	// The lightbox is a stacked layer with a fixed-size frame (the image is contained in it, so the
	// arrows never move between images), prev/next buttons, ← / → keys, a counter and the caption.
	function openZoom(btn) {
		const items = [...btn.closest(".kit-gallery").querySelectorAll("[data-kit-zoom]")].map((b) => {
			const img = b.querySelector("img");
			return { src: img?.getAttribute("src") ?? "", alt: img?.getAttribute("alt") ?? "", caption: b.dataset.caption || b.querySelector(".kit-shot-cap")?.textContent || "" };
		});
		let i = Math.min(items.length - 1, Math.max(0, Number(btn.dataset.kitZoom) || 0));
		const body = el("div", "kit-zoom");
		body.innerHTML = `<div class="kit-zoom-frame"><img alt=""></div>
			<div class="kit-zoom-bar"><button class="kit-close" data-zoom="-1" aria-label="Previous image">← Previous</button>
			<span class="kit-zoom-count dim small" aria-live="polite"></span><span class="kit-zoom-cap"></span>
			<button class="kit-close" data-zoom="1" aria-label="Next image">Next →</button></div>`;
		const img = body.querySelector("img");
		let layer = null;
		const show = () => {
			const it = items[i];
			img.src = it.src;
			img.alt = it.alt || it.caption;
			body.querySelector(".kit-zoom-count").textContent = `${i + 1} / ${items.length}`;
			body.querySelector(".kit-zoom-cap").textContent = it.caption;
			if (layer) layer.querySelector("header h2").textContent = it.caption || "Image";
			for (const b of body.querySelectorAll("[data-zoom]")) b.disabled = items.length < 2;
		};
		const step = (d) => {
			i = (i + d + items.length) % items.length;
			show();
		};
		body.addEventListener("click", (e) => {
			const b = e.target.closest("[data-zoom]");
			if (b) step(Number(b.dataset.zoom));
		});
		const keys = (e) => {
			if (stack[stack.length - 1] !== layer) return;
			if (e.key === "ArrowRight") step(1);
			else if (e.key === "ArrowLeft") step(-1);
			else return;
			e.preventDefault();
		};
		document.addEventListener("keydown", keys);
		show();
		layer = openLayer(items[i].caption || "Image", body, { cls: "kit-lightbox", onClose: () => document.removeEventListener("keydown", keys) });
		layer.dataset.zoom = "1";
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
			const zoom = e.target.closest("[data-kit-zoom]");
			if (zoom) {
				e.preventDefault();
				hideTip(true);
				return openZoom(zoom);
			}
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

	// ── fit the bird's-eye to one screen ────────────────────────────────────
	// Desktop: a bird's-eye page never scrolls and never leaves half the screen empty. With a paged
	// grid (.kit-pages) the page fills the window height and the grid shows as many uniform cards as
	// fit, with a pager; otherwise the whole bird's-eye is zoomed to the largest size that still fits.
	const DESKTOP_MIN_W = 700;
	const ZOOM_MIN = 0.6;
	const ZOOM_MAX = 1.5;
	function fitPage() {
		if (!document.body.dataset.artifact) return; // kit pages only (home has its own layout)
		const main = document.querySelector(".kit-birdseye");
		if (!main) return;
		const desktop = innerWidth >= DESKTOP_MIN_W;
		// Measure with the page scrollbar suppressed: a classic scrollbar that appears while trying a
		// too-big size narrows the page, reflows it taller, and then never goes away again.
		const root = document.documentElement;
		root.style.overflow = desktop ? "hidden" : "";
		try {
			const box = main.querySelector(".kit-pages");
			if (box) return layoutPages(main, box, desktop);
			main.style.zoom = "";
			main.classList.toggle("kit-fit", desktop);
			balanceTiles(main, desktop);
			if (!desktop) return;
			const se = document.scrollingElement || root;
			// Fractional: scrollHeight is rounded, so 838.3px of content in an 838px window "fits" by
			// scrollHeight yet still overflows by 0.3px, and that brings a scrollbar at 125% scaling.
			const fits = (z) => {
				main.style.zoom = String(z);
				balanceTiles(main, true);
				const bottom = Math.max(main.getBoundingClientRect().bottom, document.body.getBoundingClientRect().bottom) + scrollY;
				return bottom <= se.clientHeight - 0.5 && se.scrollWidth <= se.clientWidth + 0.5;
			};
			let z = ZOOM_MAX;
			if (!fits(z)) {
				let lo = ZOOM_MIN;
				let hi = ZOOM_MAX;
				for (let i = 0; i < 9; i++) {
					const mid = (lo + hi) / 2;
					if (fits(mid)) lo = mid;
					else hi = mid;
				}
				z = Math.floor(lo * 100) / 100;
				fits(z);
			}
			// Verify with the real scrollbar back: a page that fits must not keep one. Step down until gone.
			root.style.overflow = "";
			for (let i = 0; i < 20 && z > ZOOM_MIN && innerWidth - root.clientWidth > 0; i++) {
				z = Math.round((z - 0.01) * 100) / 100;
				fits(z);
			}
		} finally {
			root.style.overflow = "";
		}
	}

	/** Tiles and gallery thumbnails: as many per row as fit, rows evenly filled (6 → 3 + 3, never 5 + 1). */
	const TILE_MIN_W = 170;
	const SHOT_MIN_W = 200;
	function balanceTiles(root, desktop) {
		for (const t of root.querySelectorAll(".kit-tiles, .kit-gallery")) {
			t.style.gridTemplateColumns = "";
			const n = t.children.length;
			if (!n) continue;
			const gallery = t.classList.contains("kit-gallery");
			if (!desktop && !gallery) continue;
			const minW = Math.min(t.clientWidth || 1, gallery ? Number(t.dataset.minW) || SHOT_MIN_W : TILE_MIN_W);
			const gap = parseFloat(getComputedStyle(t).columnGap) || 10;
			const most = Math.max(1, Math.floor((t.clientWidth + gap) / (minW + gap)));
			const cols = Math.ceil(n / Math.ceil(n / most));
			t.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
		}
	}
	/** Balances the grids inside a freshly opened layer (its width is known only once it is shown). */
	const balance = (root) => balanceTiles(root, innerWidth >= DESKTOP_MIN_W);

	/**
	 * How to page `n` cards with at most `maxCols` × `maxRows` per page. Pages are split by count, not
	 * filled one after another (26 at 5 × 2 → 9 + 9 + 8, never 10 + 10 + 6). The one rule for every paged
	 * grid (home library, kit pages): no card alone on a row, then fewest pages (at most one more than the
	 * widest grid needs), then evenness, then width (22 at 5 × 3 → 4 columns, 11 + 11).
	 * Returns { cols, rows, pages, sizes: cards per page, starts: each page's first card }.
	 */
	const lexLess = (a, b) => {
		for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
		return false;
	};
	const loneRow = (size, cols) => cols > 1 && size > 1 && size % cols === 1;
	/** `count` page sizes from `sizes` (largest first) that add up to `n`, largest first; or null. */
	function pickSizes(n, count, sizes) {
		const dead = new Set();
		const go = (left, k, from) => {
			if (k === 0) return left === 0 ? [] : null;
			const key = `${left},${k},${from}`;
			if (dead.has(key)) return null;
			for (let j = from; j < sizes.length; j++) {
				if (sizes[j] * k < left || sizes[sizes.length - 1] * k > left) break;
				const rest = go(left - sizes[j], k - 1, j);
				if (rest) return [sizes[j], ...rest];
			}
			dead.add(key);
			return null;
		};
		return go(n, count, 0);
	}
	/** The most even split of `n` cards into `pages` pages of at most `cap`, with no lone card on a row if one exists. */
	function splitPages(n, pages, cols, cap) {
		for (let spread = 0; spread <= cols; spread++) {
			for (let lo = Math.max(1, Math.ceil(n / pages) - spread); lo <= Math.floor(n / pages); lo++) {
				const sizes = [];
				for (let s = Math.min(cap, lo + spread); s >= lo; s--) if (!loneRow(s, cols)) sizes.push(s);
				const picked = pickSizes(n, pages, sizes);
				if (picked) return { sizes: picked, lone: 0 };
			}
		}
		return { sizes: Array.from({ length: pages }, (_, i) => Math.floor(n / pages) + (i < n % pages ? 1 : 0)), lone: 1 };
	}
	function pagePlan(n, maxCols, maxRows) {
		const mostPages = Math.max(1, Math.min(n, Math.ceil(n / (maxCols * maxRows)) + 1));
		let best = null;
		for (let c = maxCols; c >= Math.max(1, maxCols - 2); c--) {
			for (let pages = Math.max(1, Math.ceil(n / (c * maxRows))); pages <= mostPages; pages++) {
				const { sizes, lone } = splitPages(n, pages, c, c * maxRows);
				const rows = Math.max(1, Math.ceil(sizes[0] / c));
				const score = [lone, pages, sizes[0] - sizes[pages - 1], maxCols - c, rows];
				if (!best || lexLess(score, best.score)) best = { cols: c, rows, pages, sizes, score };
			}
		}
		best.starts = best.sizes.map((_, i) => best.sizes.slice(0, i).reduce((a, b) => a + b, 0));
		return best;
	}

	const paged = new WeakMap();
	function layoutPages(main, box, desktop) {
		const grid = box.querySelector(".kit-grid");
		let st = paged.get(box);
		if (!st) {
			st = { items: [...grid.children], page: 0, pager: el("div", "kit-pager") };
			st.pager.innerHTML = '<button data-kit-prev>← Previous</button><span class="dim small"></span><button data-kit-next>Next →</button>';
			st.pager.addEventListener("click", (e) => {
				if (e.target.closest("[data-kit-prev]")) st.page--;
				else if (e.target.closest("[data-kit-next]")) st.page++;
				else return;
				fitPage();
			});
			box.appendChild(st.pager);
			paged.set(box, st);
		}
		const minW = Number(box.dataset.minW) || 240;
		const gap = parseFloat(getComputedStyle(grid).rowGap) || 10;
		grid.replaceChildren(...st.items);
		for (const it of st.items) it.style.height = "";
		grid.style.gridAutoRows = "max-content";
		if (!desktop) {
			grid.style.gridAutoRows = "";
			main.classList.remove("kit-fill");
			main.style.height = "";
			grid.style.gridTemplateColumns = `repeat(auto-fill, minmax(${Math.min(minW, 160)}px, 1fr))`;
			st.pager.hidden = true;
			return;
		}
		main.classList.add("kit-fill");
		// Whole pixels, 1px short: at 125% scaling a fractional height can round up and bring a scrollbar.
		const se = document.scrollingElement || document.documentElement;
		main.style.height = `${Math.max(240, Math.floor(se.clientHeight - main.getBoundingClientRect().top - scrollY) - 1)}px`;
		const cols = Math.max(1, Math.floor((grid.clientWidth + gap) / (minW + gap)));
		grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
		const need = Math.max(...st.items.map((it) => Math.max(it.offsetHeight, it.scrollHeight) + 1), 40);
		const maxRows = (withPager) => {
			st.pager.hidden = !withPager;
			return Math.max(1, Math.floor((grid.clientHeight + gap) / (need + gap)));
		};
		let plan = pagePlan(st.items.length, cols, maxRows(false));
		if (plan.pages > 1) plan = pagePlan(st.items.length, cols, maxRows(true));
		const { pages, rows, sizes, starts } = plan;
		grid.style.gridTemplateColumns = `repeat(${plan.cols}, minmax(0, 1fr))`;
		st.page = Math.min(Math.max(0, st.page), pages - 1);
		const avail = grid.clientHeight;
		grid.style.gridAutoRows = `${Math.max(need, Math.floor((avail - gap * (rows - 1)) / rows))}px`;
		grid.replaceChildren(...st.items.slice(starts[st.page], starts[st.page] + sizes[st.page]));
		st.pager.querySelector("[data-kit-prev]").disabled = st.page === 0;
		st.pager.querySelector("[data-kit-next]").disabled = st.page >= pages - 1;
		st.pager.querySelector("span").textContent = `Page ${st.page + 1} of ${pages} · ${st.items.length} items`;
	}
	let fitTimer = 0;
	const refit = () => {
		clearTimeout(fitTimer);
		fitTimer = setTimeout(fitPage, 80);
	};

	// ── live reload: reload when this artifact's file changes ───────────────
	// A reload must never land under a click: not while a button is pressed, not just after one.
	let lastPointer = -1e9;
	let pointerDown = false;
	addEventListener("pointerdown", () => { pointerDown = true; lastPointer = performance.now(); }, true);
	addEventListener("pointerup", () => { pointerDown = false; lastPointer = performance.now(); }, true);
	addEventListener("pointercancel", () => { pointerDown = false; }, true);
	const busy = () => pointerDown || performance.now() - lastPointer < 2000;

	function live() {
		const id = document.body.dataset.artifact;
		if (!id) return;
		let seen = 0;
		setInterval(async () => {
			if (document.hidden || stack.length || busy()) return;
			try {
				const r = await (await fetch(`/api/mtime?id=${encodeURIComponent(id)}`)).json();
				if (seen && r.mtime && r.mtime !== seen && !stack.length && !busy()) location.reload();
				seen = r.mtime || seen;
			} catch {}
		}, 5000);
	}

	async function init() {
		try {
			glossary = (await (await fetch("/api/glossary")).json()).terms || {};
		} catch {
			glossary = {};
		}
		markReady();
		const main = document.querySelector(".kit-birdseye") || document.body;
		annotate(main);
		wire(document.body);
		fitPage();
		document.fonts?.ready.then(fitPage);
		window.addEventListener("resize", refit);
		live();
	}
	window.kit = { openModal, openTerm, openLayer, annotate, ready, fitPage, pagePlan, busy, depth: () => stack.length };
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
	else init();
})();
