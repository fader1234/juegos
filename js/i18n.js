/*
 * Sistema de idiomas compartido por el portal y todos los juegos.
 * Idiomas: español, inglés, italiano y ruso.
 *
 * Uso en una página:
 *   I18N.add({ es: {...}, en: {...}, it: {...}, ru: {...} });
 *   I18N.t("clave", { n: 3 });
 *   <span data-i18n="clave"></span>  → se traduce solo
 *   I18N.mount(elemento)             → añade el selector de idioma
 */
(function () {
  const LANGS = [
    { code: "es", label: "Español", flag: "🇪🇸" },
    { code: "en", label: "English", flag: "🇬🇧" },
    { code: "it", label: "Italiano", flag: "🇮🇹" },
    { code: "ru", label: "Русский", flag: "🇷🇺" },
  ];
  const KEY = "portal-lang";
  const dict = { es: {}, en: {}, it: {}, ru: {} };
  const listeners = [];

  function detect() {
    try {
      const q = new URLSearchParams(location.search).get("lang");
      if (q && dict[q]) return q;
    } catch (e) {}
    try {
      const s = localStorage.getItem(KEY);
      if (s && dict[s]) return s;
    } catch (e) {}
    const prefs = navigator.languages || [navigator.language || "es"];
    for (const l of prefs) {
      const c = String(l).slice(0, 2).toLowerCase();
      if (dict[c]) return c;
    }
    return "es";
  }

  let lang = detect();

  function t(key, vars) {
    let v = dict[lang][key];
    if (v === undefined) v = dict.es[key];
    if (v === undefined) return key;
    if (typeof v === "function") return v(vars || {});
    if (vars) v = v.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
    return v;
  }

  // Elige el texto del idioma actual de un objeto { es, en, it, ru }
  function pick(obj) {
    if (!obj || typeof obj !== "object") return obj;
    return obj[lang] || obj.es || Object.values(obj)[0];
  }

  function apply(root) {
    root = root || document;
    root.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
    root.querySelectorAll("[data-i18n-html]").forEach((el) => (el.innerHTML = t(el.dataset.i18nHtml)));
    root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => (el.placeholder = t(el.dataset.i18nPlaceholder)));
    root.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      el.setAttribute("aria-label", t(el.dataset.i18nAria));
      el.title = t(el.dataset.i18nAria);
    });
    document.documentElement.lang = lang;
    if (dict[lang].pageTitle || dict.es.pageTitle) document.title = t("pageTitle");
  }

  function set(code) {
    if (!dict[code]) return;
    lang = code;
    try { localStorage.setItem(KEY, code); } catch (e) {}
    document.querySelectorAll(".lang-select").forEach((s) => (s.value = code));
    apply();
    listeners.forEach((f) => f(code));
  }

  function mount(el) {
    const s = document.createElement("select");
    s.className = "lang-select";
    s.setAttribute("aria-label", "Idioma / Language / Lingua / Язык");
    LANGS.forEach((l) => {
      const o = document.createElement("option");
      o.value = l.code;
      o.textContent = `${l.flag} ${l.label}`;
      s.appendChild(o);
    });
    s.value = lang;
    s.addEventListener("change", () => set(s.value));
    el.appendChild(s);
  }

  function add(d) {
    for (const c in d) Object.assign(dict[c] || (dict[c] = {}), d[c]);
  }

  // Textos comunes a todas las páginas
  add({
    es: { back: "← Portal" },
    en: { back: "← Games" },
    it: { back: "← Portale" },
    ru: { back: "← Портал" },
  });

  window.I18N = {
    LANGS,
    t,
    pick,
    add,
    apply,
    set,
    mount,
    get lang() { return lang; },
    onChange: (f) => listeners.push(f),
  };
})();
