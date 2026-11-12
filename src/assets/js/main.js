// Team Resistance site behaviour. Progressive enhancement only:
// every link, menu and form still works without JavaScript.
(() => {
  "use strict";

  /* ---------------- Navigation ---------------- */
  const header = document.querySelector("[data-header]");
  const toggle = document.querySelector("[data-nav-toggle]");
  const nav = document.querySelector("[data-nav]");
  const subToggles = [...document.querySelectorAll("[data-sub-toggle]")];
  const mobileQuery = window.matchMedia("(max-width: 64rem)");

  const setSub = (btn, open) => {
    btn.setAttribute("aria-expanded", String(open));
    document.getElementById(btn.getAttribute("aria-controls")).hidden = !open;
  };
  const closeAllSubs = (except) => subToggles.forEach((b) => b !== except && setSub(b, false));

  const setMenu = (open) => {
    if (!toggle) return;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.querySelector(".nav-toggle__label").textContent = open ? "Close" : "Menu";
    if (open) nav.setAttribute("data-open", "");
    else { nav.removeAttribute("data-open"); closeAllSubs(); }
  };

  subToggles.forEach((b) => setSub(b, false));

  toggle?.addEventListener("click", () => setMenu(toggle.getAttribute("aria-expanded") !== "true"));

  subToggles.forEach((btn) => {
    btn.addEventListener("click", () => {
      const open = btn.getAttribute("aria-expanded") !== "true";
      if (!mobileQuery.matches) closeAllSubs(btn);
      setSub(btn, open);
    });
  });

  // Escape closes the open dropdown (desktop) or the menu (mobile) and returns focus.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const openSub = subToggles.find((b) => b.getAttribute("aria-expanded") === "true");
    if (openSub && !mobileQuery.matches) { setSub(openSub, false); openSub.focus(); return; }
    if (toggle?.getAttribute("aria-expanded") === "true") { setMenu(false); toggle.focus(); }
  });

  // Clicking outside, or tabbing out of a dropdown, closes it on desktop.
  document.addEventListener("click", (e) => {
    if (!mobileQuery.matches && !e.target.closest(".has-sub")) closeAllSubs();
  });
  document.querySelectorAll(".has-sub").forEach((li) => {
    li.addEventListener("focusout", (e) => {
      if (!mobileQuery.matches && !li.contains(e.relatedTarget)) closeAllSubs();
    });
  });

  mobileQuery.addEventListener("change", () => setMenu(false));

  /* ---------------- Gallery lightbox ---------------- */
  // Uses native <dialog>: focus is contained, Escape closes, page behind is inert.
  const galleries = document.querySelectorAll("[data-gallery]");
  if (galleries.length && "HTMLDialogElement" in window) {
    const dlg = document.createElement("dialog");
    dlg.className = "lightbox";
    dlg.setAttribute("aria-label", "Photo viewer");
    dlg.innerHTML = `
      <div class="lightbox__inner">
        <div class="lightbox__bar">
          <p aria-live="polite" data-count></p>
          <button class="btn" type="button" data-close>Close<span class="vh"> photo viewer</span></button>
        </div>
        <figure><img alt="" data-img><figcaption data-cap></figcaption></figure>
        <div class="lightbox__controls">
          <button class="btn" type="button" data-prev>Previous<span class="vh"> photo</span></button>
          <button class="btn" type="button" data-next>Next<span class="vh"> photo</span></button>
        </div>
      </div>`;
    document.body.append(dlg);
    const img = dlg.querySelector("[data-img]");
    const cap = dlg.querySelector("[data-cap]");
    const count = dlg.querySelector("[data-count]");
    let items = [], index = 0, opener = null;

    const show = (i) => {
      index = (i + items.length) % items.length;
      const link = items[index];
      const thumb = link.querySelector("img");
      img.src = link.href;
      img.alt = thumb.alt;
      const fc = link.closest("figure").querySelector("figcaption");
      cap.textContent = fc ? fc.textContent.trim() : "";
      count.textContent = `Photo ${index + 1} of ${items.length}`;
    };

    galleries.forEach((g) => {
      const links = [...g.querySelectorAll(".gallery__link")];
      links.forEach((a, i) => {
        a.addEventListener("click", (e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey) return; // let users open in a new tab
          e.preventDefault();
          items = links; opener = a;
          show(i);
          dlg.showModal();
          dlg.querySelector("[data-close]").focus();
        });
      });
    });
    dlg.querySelector("[data-close]").addEventListener("click", () => dlg.close());
    dlg.querySelector("[data-prev]").addEventListener("click", () => show(index - 1));
    dlg.querySelector("[data-next]").addEventListener("click", () => show(index + 1));
    dlg.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") show(index - 1);
      if (e.key === "ArrowRight") show(index + 1);
    });
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener("close", () => { img.removeAttribute("src"); opener?.focus(); });
  }

  /* ---------------- Contact form ---------------- */
  const form = document.querySelector("[data-contact-form]");
  if (form) {
    // Pre-select inquiry type from ?type=… links (e.g. "Join the team").
    const typeSelect = form.querySelector("#inquiry");
    const param = new URLSearchParams(location.search).get("type");
    if (param && typeSelect.querySelector(`option[value="${CSS.escape(param)}"]`)) typeSelect.value = param;

    // Show only the fieldsets that apply to the selected inquiry type.
    const syncGroups = () => {
      form.querySelectorAll("[data-show-for]").forEach((group) => {
        const show = group.dataset.showFor.split(" ").includes(typeSelect.value);
        group.hidden = !show;
        group.querySelectorAll("input, select, textarea").forEach((el) => (el.disabled = !show));
      });
    };
    typeSelect.addEventListener("change", syncGroups);
    syncGroups();

    // Accessible validation: inline messages + an error summary that receives focus.
    form.setAttribute("novalidate", "");
    const summary = form.querySelector("[data-error-summary]");
    const clearError = (el) => {
      el.removeAttribute("aria-invalid");
      const msg = document.getElementById(el.id + "-error");
      if (msg) msg.remove();
      el.setAttribute("aria-describedby", (el.getAttribute("aria-describedby") || "").replace(el.id + "-error", "").trim());
    };
    const messageFor = (el) => {
      const label = form.querySelector(`label[for="${el.id}"]`)?.firstChild?.textContent.trim() || "This field";
      if (el.validity.valueMissing) return `Enter your ${label.toLowerCase()}`;
      if (el.validity.typeMismatch && el.type === "email") return "Enter an email address in the format name@example.com";
      return `Check your ${label.toLowerCase()}`;
    };
    form.addEventListener("submit", (e) => {
      const fields = [...form.querySelectorAll("input, select, textarea")].filter((el) => !el.disabled && el.willValidate);
      fields.forEach(clearError);
      const invalid = fields.filter((el) => !el.checkValidity());
      if (!invalid.length) { summary.hidden = true; return; }
      e.preventDefault();
      const list = summary.querySelector("ul");
      list.innerHTML = "";
      invalid.forEach((el) => {
        const text = messageFor(el);
        el.setAttribute("aria-invalid", "true");
        const p = document.createElement("p");
        p.className = "field-error"; p.id = el.id + "-error"; p.textContent = text;
        el.insertAdjacentElement("beforebegin", p);
        el.setAttribute("aria-describedby", `${el.id}-error ${el.getAttribute("aria-describedby") || ""}`.trim());
        const li = document.createElement("li");
        li.innerHTML = `<a href="#${el.id}">${text}</a>`;
        list.append(li);
      });
      summary.hidden = false;
      summary.focus();
    });
    summary?.addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (!a) return;
      e.preventDefault();
      document.querySelector(a.getAttribute("href")).focus();
    });
  }

  /* ---------------- Motion setting ----------------
     Motion (the parallax background and the scroll effects) is on by default.
     The "Animations" switch in the footer turns it off and remembers the choice. */
  const root = document.documentElement;
  const KEY = "tr-motion";
  let motion = true;
  try { motion = localStorage.getItem(KEY) !== "off"; } catch (e) { /* storage blocked: stay on */ }
  const motionListeners = [];
  const setMotion = (on, save) => {
    motion = on;
    root.classList.toggle("motion", on);
    document.querySelectorAll("[data-motion-toggle]").forEach((b) => b.setAttribute("aria-pressed", String(on)));
    if (save) { try { localStorage.setItem(KEY, on ? "on" : "off"); } catch (e) { /* ignore */ } }
    motionListeners.forEach((fn) => fn());
  };
  document.querySelectorAll("[data-motion-toggle]").forEach((b) => b.addEventListener("click", () => setMotion(!motion, true)));

  /* ---------------- Photos fade in once loaded ---------------- */
  document.querySelectorAll(".frame__img img").forEach((img) => {
    const done = () => img.classList.add("is-loaded");
    if (img.complete) done();
    else { img.addEventListener("load", done, { once: true }); img.addEventListener("error", done, { once: true }); }
  });

  /* ---------------- CAD background ----------------
     A grid whose origin sits at the bottom-left of the page title ([data-origin]).
     The grid, and the part drawings on it, scroll at 55% of the page's speed.
     Purely decorative and hidden from assistive tech. */
  const cad = document.querySelector("[data-cad]");
  const origin = document.querySelector("[data-origin]");
  if (cad && origin && cad.getContext) {
    const ctx = cad.getContext("2d");
    const RATE = 0.55; // background speed relative to the page
    const gutter = () => Math.min(40, Math.max(20, innerWidth * 0.04));
    let W = 0, H = 0, raf = 0;

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = innerWidth; H = innerHeight;
      cad.width = W * dpr; cad.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
    const circle = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); };
    const poly = (pts, close = true) => {
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      if (close) ctx.closePath(); ctx.stroke();
    };
    const hex = (x, y, r, a = 0) => poly([...Array(6)].map((_, i) => [x + r * Math.cos(a + i * Math.PI / 3), y + r * Math.sin(a + i * Math.PI / 3)]));
    const centerMark = (x, y, r) => {
      ctx.save(); ctx.strokeStyle = "rgba(255,205,0,0.16)"; ctx.setLineDash([14, 4, 3, 4]);
      line(x - r, y, x + r, y); line(x, y - r, x, y + r); ctx.restore();
    };

    // Simple robot parts, drawn as if on the same sheet as the grid.
    const parts = [
      // Spur gear with a hex bore. Turns as you scroll.
      (x, y, t) => {
        const N = 30, R = 118, r = 106, a0 = t * 0.0012;
        const pts = [];
        for (let k = 0; k < N; k++) {
          const a = a0 + (k / N) * Math.PI * 2, w = (Math.PI * 2) / N;
          pts.push([r, a], [R, a + w * 0.28], [R, a + w * 0.5], [r, a + w * 0.78]);
        }
        poly(pts.map(([rr, a]) => [x + rr * Math.cos(a), y + rr * Math.sin(a)]));
        circle(x, y, 38); hex(x, y, 15, a0);
        for (let k = 0; k < 6; k++) { const a = a0 + (k / 6) * Math.PI * 2; circle(x + 70 * Math.cos(a), y + 70 * Math.sin(a), 19); }
        centerMark(x, y, R + 26);
      },
      // 2x1 box tube with a 1/2" hole pattern, and its hidden inner wall.
      (x, y) => {
        const L = 540, h = 46;
        ctx.strokeRect(x - h / 2, y - L / 2, h, L);
        ctx.save(); ctx.setLineDash([6, 4]); ctx.strokeRect(x - h / 2 + 5, y - L / 2, h - 10, L); ctx.restore();
        for (let k = -10; k <= 10; k++) circle(x, y + k * 25, 5);
        centerMark(x, y, L / 2 + 20);
      },
      // Gusset plate with a lightening pocket.
      (x, y) => {
        const o = [x - 110, y - 110];
        poly([[0, 0], [220, 0], [220, 64], [64, 220], [0, 220]].map(([a, b]) => [o[0] + a, o[1] + b]));
        poly([[40, 40], [170, 40], [40, 170]].map(([a, b]) => [o[0] + a, o[1] + b]));
        for (let k = 0; k < 8; k++) { circle(o[0] + 12 + k * 25, o[1] + 14, 5); circle(o[0] + 14, o[1] + 37 + k * 25, 5); }
      },
      // Chain sprocket. Turns the other way.
      (x, y, t) => {
        const N = 42, R = 96, a0 = -t * 0.0016;
        const pts = [];
        for (let k = 0; k < N * 2; k++) { const a = a0 + (k / (N * 2)) * Math.PI * 2; const rr = k % 2 ? R - 8 : R; pts.push([x + rr * Math.cos(a), y + rr * Math.sin(a)]); }
        poly(pts);
        circle(x, y, 22); hex(x, y, 9.5, a0);
        for (let k = 0; k < 5; k++) { const a = a0 + (k / 5) * Math.PI * 2 + 0.6; circle(x + 56 * Math.cos(a), y + 56 * Math.sin(a), 15); }
        centerMark(x, y, R + 24);
      },
      // Flanged bearing block.
      (x, y) => {
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - 90, y - 46, 180, 92, 12) : ctx.rect(x - 90, y - 46, 180, 92); ctx.stroke();
        circle(x, y, 34); circle(x, y, 24); hex(x, y, 10);
        circle(x - 64, y, 7); circle(x + 64, y, 7);
        centerMark(x, y, 112);
      },
    ];

    const draw = () => {
      raf = 0;
      const sy = window.scrollY || 0;
      const move = motion ? sy * (1 - RATE) : 0;
      const a = origin.getBoundingClientRect();
      const ox = a.left, oy = a.bottom;
      const gy = oy + move; // the grid lags behind the page
      const lineAlpha = Math.max(0, 1 - sy / 220);

      ctx.clearRect(0, 0, W, H);
      const sp = 20;
      ctx.lineWidth = 1;
      for (let x = ox - Math.ceil(ox / sp) * sp; x <= W; x += sp) {
        ctx.strokeStyle = Math.round((x - ox) / sp) % 5 === 0 ? "rgba(255,255,255,0.075)" : "rgba(255,255,255,0.03)";
        line(Math.round(x) + 0.5, 0, Math.round(x) + 0.5, H);
      }
      for (let y = gy - Math.ceil(gy / sp) * sp; y <= H; y += sp) {
        ctx.strokeStyle = Math.round((y - gy) / sp) % 5 === 0 ? "rgba(255,255,255,0.075)" : "rgba(255,255,255,0.03)";
        line(0, Math.round(y) + 0.5, W, Math.round(y) + 0.5);
      }

      // Part drawings on the side margins, alternating right and left. They
      // are fainter where they pass behind the text column.
      const col = Math.min(W - 2 * gutter(), 1240), left = (W - col) / 2, right = left + col;
      const step = 820, first = H * 1.05;
      const drawParts = () => {
        for (let i = 0; ; i++) {
          const y = first + i * step - sy + move; // sheet position, on screen
          if (y - 300 > H) break;
          if (y + 300 < 0) continue;
          const x = i % 2 === 0 ? Math.max(right + left * 0.35, W - 40) : Math.min(left * 0.65, 40);
          parts[i % parts.length](x, y, sy);
        }
      };
      ctx.lineWidth = 1;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, left, H); ctx.rect(right, 0, W - right, H); ctx.clip();
      ctx.strokeStyle = "rgba(255,255,255,0.1)"; drawParts(); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.rect(left, 0, col, H); ctx.clip();
      ctx.strokeStyle = "rgba(255,255,255,0.035)"; drawParts(); ctx.restore();

      // Construction lines and axes belong to the title: they fade as you scroll.
      if (lineAlpha > 0) {
        ctx.setLineDash([10, 4, 2, 4]);
        ctx.strokeStyle = `rgba(255,205,0,${0.28 * lineAlpha})`; line(0, oy, W, oy);
        ctx.strokeStyle = `rgba(100,244,38,${0.28 * lineAlpha})`; line(ox, Math.max(0, oy - 260), ox, oy + 40);
        ctx.setLineDash([]);
      }
      if (oy > -200 && oy < H + 200) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(255,205,0,0.85)"; line(ox, oy, ox + 96, oy);
        ctx.strokeStyle = "rgba(100,244,38,0.85)"; line(ox, oy, ox, oy - 96);
        ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(255,255,255,0.75)";
        ctx.beginPath(); ctx.arc(ox, oy, 6, 0, Math.PI * 2); ctx.stroke();
        ctx.font = "600 13px 'Barlow Condensed', sans-serif";
        ctx.fillStyle = "rgba(255,205,0,0.9)"; ctx.fillText("X", ox + 102, oy + 4);
        ctx.fillStyle = "rgba(100,244,38,0.9)"; ctx.fillText("Y", ox - 3, oy - 104);
      }
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(draw); };
    size(); draw();
    if (document.fonts) document.fonts.ready.then(queue);
    window.addEventListener("load", queue);
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", () => { size(); queue(); });
    motionListeners.push(queue);
  }

  /* ---------------- Scroll effects ----------------
     Tied to the scroll position (not timers), so they run forwards and
     backwards with the page, like a scrubbed video:
       .dim          dimension lines draw out
       .fig--hero    large photos open up from a smaller window
       .frame__img   photos drift slightly inside their frames
       rise          gallery tiles and robot cards rise into place
       .chart        the record chart fills in, oldest season first
       .banners      blue banners unroll from their pole
       [data-words]  big statements light up word by word
     Any page built from the shared components gets these automatically. */
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const fx = [];
  const track = (sel, kind) => document.querySelectorAll(sel).forEach((el) => fx.push({ el, kind }));

  // Split statements into words so they can light up one by one.
  document.querySelectorAll("[data-words]").forEach((el) => {
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) frag.append(part);
            else { const w = document.createElement("span"); w.className = "wd"; w.textContent = part; frag.append(w); }
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
  });

  track(".dim", "line");
  track(".fig--hero", "open");
  track(".frame__img", "drift");
  track(".gallery__grid > li, .strip > .fig, .season-list > li", "rise");
  track(".chart", "chart");
  track(".banners", "banners");
  track("[data-words]", "words");

  fx.forEach((f) => {
    if (f.kind === "chart") f.items = [...f.el.querySelectorAll(".sq, .ch")].sort((a, b) => parseFloat(a.style.left) - parseFloat(b.style.left));
    if (f.kind === "banners") f.items = [...f.el.children];
    if (f.kind === "words") f.items = [...f.el.querySelectorAll(".wd")];
  });

  const apply = (f, vh) => {
    const r = f.el.getBoundingClientRect();
    // 0 when the element's top enters the bottom of the screen, 1 once it is 45% up.
    // Large photos and dimension lines finish earlier (60% up), so ones near the top of a
    // page is already fully open when the page loads.
    const span = f.kind === "open" || f.kind === "line" ? 0.32 : 0.47;
    const p = motion ? clamp((vh * 0.92 - r.top) / (vh * span)) : 1;
    switch (f.kind) {
      case "line": case "open": case "rise":
        f.el.style.setProperty("--p", p.toFixed(3)); break;
      case "drift":
        f.el.style.setProperty("--d", motion ? clamp((r.top + r.height / 2 - vh / 2) / vh, -1, 1).toFixed(3) : 0); break;
      case "chart": {
        const n = f.items.length, q = motion ? clamp((vh * 0.95 - r.top) / (vh * 0.5)) : 1;
        f.items.forEach((it, i) => it.classList.toggle("on", q * n >= i + 0.5)); break;
      }
      case "banners": {
        const n = f.items.length;
        f.items.forEach((it, i) => it.style.setProperty("--u", clamp(p * (1 + n * 0.35) - i * 0.35).toFixed(3))); break;
      }
      case "words": {
        const n = f.items.length, q = motion ? clamp((vh * 0.85 - r.top) / (vh * 0.45)) : 1;
        // Unlit words stay at 50%, still above 3:1 contrast for this large text.
        f.items.forEach((w, i) => (w.style.opacity = (0.5 + 0.5 * clamp(q * (n + 3) - i - 1)).toFixed(3))); break;
      }
    }
  };

  const visible = new Set();
  let ticking = 0;
  const run = (all) => {
    ticking = 0;
    const vh = innerHeight;
    (all ? fx : [...visible]).forEach((f) => apply(f, vh));
  };
  const tick = () => { if (!ticking) ticking = requestAnimationFrame(() => run(false)); };
  if ("IntersectionObserver" in window) {
    const byEl = new Map(fx.map((f) => [f.el, f]));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { const f = byEl.get(e.target); if (e.isIntersecting) { visible.add(f); apply(f, innerHeight); } else visible.delete(f); });
    }, { rootMargin: "25% 0px 25% 0px" });
    fx.forEach((f) => io.observe(f.el));
  } else {
    fx.forEach((f) => visible.add(f));
  }
  window.addEventListener("scroll", tick, { passive: true });
  window.addEventListener("resize", () => run(true));
  motionListeners.push(() => run(true));
  setMotion(motion, false);
  run(true);
})();
