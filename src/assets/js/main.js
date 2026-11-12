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

  /* ---------------- CAD viewport ----------------
     A grid whose origin sits at the bottom-left of the page title ([data-origin]).
     Sections marked data-zoom="2.5" zoom the grid in as they reach the middle
     of the screen. Purely decorative: hidden from assistive tech, static for
     people who prefer reduced motion. */
  const cad = document.querySelector("[data-cad]");
  const origin = document.querySelector("[data-origin]");
  if (cad && origin && cad.getContext) {
    const ctx = cad.getContext("2d");
    const zones = [...document.querySelectorAll("[data-zoom]")];
    const outX = document.querySelector("[data-x]"), outY = document.querySelector("[data-y]");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    const MM = 0.2646; // CSS px to mm at 96 dpi
    let W = 0, H = 0, z = 1, raf = 0, ox = 0, oy = 0, mx = null, my = null;

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = innerWidth; H = innerHeight;
      cad.width = W * dpr; cad.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const target = () => {
      if (still.matches) return 1;
      let t = 1;
      for (const s of zones) {
        const r = s.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - H / 2) / (Math.max(r.height, H) * 0.7);
        const k = Math.max(0, 1 - d), e = k * k * (3 - 2 * k);
        t = Math.max(t, 1 + (parseFloat(s.dataset.zoom) - 1) * e);
      }
      return t;
    };
    const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
    const readout = () => {
      if (mx === null || !outX) return;
      outX.textContent = (((mx - ox) / z) * MM).toFixed(1);
      outY.textContent = (((oy - my) / z) * MM).toFixed(1);
    };
    const draw = () => {
      raf = 0;
      const tz = target();
      z += still.matches ? tz - z : (tz - z) * 0.14;
      if (Math.abs(tz - z) < 0.002) z = tz;
      const a = origin.getBoundingClientRect();
      const fx = W / 2, fy = H / 2;
      ox = fx + (a.left - fx) * z; oy = fy + (a.bottom - fy) * z;
      // The grid scrolls at 55% of page speed (parallax); the origin stays on the title.
      const sy = window.scrollY || 0;
      const gy = fy + (a.bottom + (still.matches ? 0 : sy * 0.45) - fy) * z;
      // Construction lines belong to the title: they fade out as soon as you scroll.
      const lineAlpha = Math.max(0, 1 - sy / 220);

      ctx.clearRect(0, 0, W, H);
      let sp = 20 * z;
      while (sp >= 100) sp /= 5;
      const fade = Math.min(1, (sp - 20) / 30 + 0.35);
      ctx.lineWidth = 1;
      for (let x = ox - Math.ceil(ox / sp) * sp; x <= W; x += sp) {
        ctx.strokeStyle = Math.round((x - ox) / sp) % 5 === 0 ? "rgba(255,255,255,0.08)" : `rgba(255,255,255,${0.035 * fade})`;
        line(Math.round(x) + 0.5, 0, Math.round(x) + 0.5, H);
      }
      for (let y = gy - Math.ceil(gy / sp) * sp; y <= H; y += sp) {
        ctx.strokeStyle = Math.round((y - gy) / sp) % 5 === 0 ? "rgba(255,255,255,0.08)" : `rgba(255,255,255,${0.035 * fade})`;
        line(0, Math.round(y) + 0.5, W, Math.round(y) + 0.5);
      }
      // Construction lines through the origin, then the axes.
      if (lineAlpha > 0) {
        ctx.setLineDash([10, 4, 2, 4]);
        ctx.strokeStyle = `rgba(255,205,0,${0.28 * lineAlpha})`; line(0, oy, W, oy);
        ctx.strokeStyle = `rgba(100,244,38,${0.28 * lineAlpha})`; line(ox, Math.max(0, oy - 260), ox, oy + 40);
        ctx.setLineDash([]);
      }
      if (ox > -200 && ox < W + 200 && oy > -200 && oy < H + 200) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(255,205,0,0.85)"; line(ox, oy, ox + 96, oy);
        ctx.strokeStyle = "rgba(100,244,38,0.85)"; line(ox, oy, ox, oy - 96);
        ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(255,255,255,0.75)";
        ctx.beginPath(); ctx.arc(ox, oy, 6, 0, Math.PI * 2); ctx.stroke();
        ctx.font = "600 13px 'Barlow Condensed', sans-serif";
        ctx.fillStyle = "rgba(255,205,0,0.9)"; ctx.fillText("X", ox + 102, oy + 4);
        ctx.fillStyle = "rgba(100,244,38,0.9)"; ctx.fillText("Y", ox - 3, oy - 104);
      }
      readout();
      if (z !== tz) raf = requestAnimationFrame(draw);
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(draw); };
    size(); draw();
    if (document.fonts) document.fonts.ready.then(queue);
    window.addEventListener("load", queue);
    window.addEventListener("scroll", () => { queue(); if (!raf) raf = requestAnimationFrame(draw); }, { passive: true });
    window.addEventListener("resize", () => { size(); queue(); });
    window.addEventListener("pointermove", (e) => { mx = e.clientX; my = e.clientY; readout(); }, { passive: true });
    still.addEventListener("change", queue);
  }

  /* ---------------- Scroll reveals ----------------
     Dimension lines draw, framed photos wipe in, the record chart stacks up
     and robot illustrations are drawn, each once, as they enter the screen. */
  const revealables = document.querySelectorAll(".dim, .frame, .chart, .robot-art[data-draw]");
  document.querySelectorAll(".robot-art[data-draw] .r-o").forEach((el) => el.setAttribute("pathLength", "1"));
  document.querySelectorAll(".chart").forEach((c) => c.querySelectorAll(".sq, .ch").forEach((el, i) => el.style.setProperty("--i", i)));
  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.15 });
    revealables.forEach((el) => {
      if (el.matches(".dim, .frame, .chart")) el.setAttribute("data-reveal", "");
      io.observe(el);
    });
  } else {
    revealables.forEach((el) => el.classList.add("is-in"));
  }
})();
