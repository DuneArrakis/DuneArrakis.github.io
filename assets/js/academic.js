(() => {
  "use strict";

  // The complete archive is rendered by Jekyll; filtering is progressive enhancement.
  const filters = document.querySelector("[data-archive-filters]");
  if (filters) {
    const search = document.getElementById("archive-search");
    const tag = document.getElementById("archive-tag");
    const status = document.getElementById("filter-status");
    const empty = document.getElementById("search-empty");
    const rows = [...document.querySelectorAll("[data-archive-row]")].map((element) => ({
      element,
      title: element.dataset.title.toLocaleLowerCase(),
      tags: JSON.parse(element.dataset.tags || "[]")
    }));
    function filter() {
      const query = search.value.trim().toLocaleLowerCase();
      let count = 0;
      rows.forEach((row) => {
        const text = `${row.title} ${row.tags.join(" ").toLocaleLowerCase()}`;
        const visible = text.includes(query) && (!tag.value || row.tags.includes(tag.value));
        row.element.hidden = !visible;
        if (visible) count += 1;
      });
      document.querySelectorAll("[data-archive-year]").forEach((year) => {
        year.hidden = !year.querySelector("[data-archive-row]:not([hidden])");
      });
      status.hidden = !query && !tag.value;
      status.textContent = `找到 ${count} 篇文章`;
      empty.hidden = count !== 0;
    }
    filters.hidden = false;
    search.addEventListener("input", filter);
    tag.addEventListener("change", filter);
    document.getElementById("reset-filters").addEventListener("click", () => {
      search.value = "";
      tag.value = "";
      filter();
      search.focus();
    });
    // Restore the right result when a browser restores form values on Back.
    window.addEventListener("pageshow", filter);
    filter();
  }

  document.querySelectorAll(".prose table").forEach((table) => {
    const scroller = document.createElement("div");
    scroller.className = "table-scroll";
    scroller.tabIndex = 0;
    scroller.setAttribute("role", "region");
    scroller.setAttribute("aria-label", "表格，可左右滑动查看");
    table.before(scroller);
    scroller.append(table);
  });

  const article = document.querySelector("[data-post-content]");
  const toc = document.querySelector("[data-toc]");
  // GitHub Pages may enforce Kramdown's MathJax output. Keep those formulas
  // readable before KaTeX loads, and feed them through the same renderer.
  if (article) {
    article.querySelectorAll('script[type^="math/tex"]').forEach((source) => {
      const display = source.type.includes("mode=display");
      const formula = document.createElement(display ? "div" : "span");
      const delimiter = display ? "$$" : "$";
      formula.textContent = `${delimiter}${source.textContent}${delimiter}`;
      source.replaceWith(formula);
    });
  }
  if (article && toc) {
    const headings = [...article.querySelectorAll("h2, h3")];
    if (headings.length > 1) {
      headings.forEach((heading, index) => {
        if (!heading.id) {
          let id = `article-section-${index + 1}`;
          while (document.getElementById(id)) id += "-section";
          heading.id = id;
        }
        const link = document.createElement("a");
        link.href = `#${encodeURIComponent(heading.id)}`;
        link.textContent = heading.textContent;
        if (heading.tagName === "H3") link.className = "toc-subheading";
        toc.querySelector("nav").append(link);
      });
      toc.hidden = false;
    }
  }

  function renderArticleExtras() {
    if (!article) return;
    if (window.renderMathInElement) {
      window.renderMathInElement(article, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
          { left: "\\(", right: "\\)", display: false },
          { left: "\\[", right: "\\]", display: true }
        ],
        throwOnError: false
      });
    }
    if (window.mermaid) {
      article.querySelectorAll("code.language-mermaid").forEach((code) => {
        const diagram = document.createElement("div");
        diagram.className = "mermaid";
        diagram.textContent = code.textContent;
        code.parentElement.replaceWith(diagram);
      });
      window.mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "strict" });
      window.mermaid.run({ querySelector: ".prose .mermaid", suppressErrors: true });
    }
  }
  // Run after all deferred scripts, including optional math/diagram libraries.
  if (document.readyState === "complete") renderArticleExtras();
  else document.addEventListener("DOMContentLoaded", renderArticleExtras, { once: true });

  const sectionLinks = [...document.querySelectorAll(".section-nav a")];
  if (sectionLinks.length && "IntersectionObserver" in window) {
    const sections = sectionLinks.map((link) => document.getElementById(link.hash.slice(1))).filter(Boolean);
    const visible = new Set();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visible.add(entry.target.id);
        else visible.delete(entry.target.id);
      });
      const current = sections.find((section) => visible.has(section.id));
      if (!current) return;
      sectionLinks.forEach((link) => {
        if (link.hash === `#${current.id}`) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    }, { rootMargin: "-15% 0px -55% 0px" });
    sections.forEach((section) => observer.observe(section));
  }
})();
