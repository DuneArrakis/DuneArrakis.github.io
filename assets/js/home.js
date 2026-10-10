(() => {
  "use strict";

  const wrap = document.querySelector(".wrap");
  const slides = wrap && wrap.querySelector(".slides");
  const template = slides && slides.querySelector("textarea[data-template]");
  if (!template) return;

  // Jekyll has already rendered README.md to HTML inside the theme's textarea.
  const content = template.value;
  const slideMarkup = slides.innerHTML;
  const mobile = window.matchMedia("(max-width: 767px)");
  let library;
  let deck;
  let updates = Promise.resolve();

  function loadReveal() {
    if (!library) {
      library = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/combine/npm/reveal.js@5.0.5/dist/reveal.min.js,npm/reveal.js@5.0.5/plugin/markdown/markdown.min.js,npm/reveal.js@5.0.5/plugin/math/math.min.js,npm/reveald3@2.0.0/reveald3.min.js,npm/reveal.js-mermaid-plugin@2.3.0/plugin/mermaid/mermaid.min.js";
        script.onload = resolve;
        script.onerror = reject;
        document.head.append(script);
      });
    }
    return library;
  }

  function showReadingView() {
    wrap.classList.remove("reveal");
    slides.className = "home-content";
    slides.innerHTML = content;
  }

  async function update() {
    if (deck) {
      await deck.destroy();
      deck = null;
    }
    // Keep the home page readable even while the desktop library is loading.
    showReadingView();
    if (mobile.matches) return;
    await loadReveal();
    if (mobile.matches) return;
    slides.className = "slides";
    slides.innerHTML = slideMarkup;
    wrap.classList.add("reveal");
    deck = window.Reveal;
    await deck.initialize({
      scrollActivationWidth: null,
      height: "100%",
      mouseWheel: true,
      navigationMode: "linear",
      plugins: [window.RevealMarkdown, window.RevealMath.KaTeX, window.Reveald3, window.RevealMermaid]
    });
  }

  function scheduleUpdate() {
    updates = updates.then(update).catch(() => {
      showReadingView();
    });
  }

  mobile.addEventListener("change", scheduleUpdate);
  scheduleUpdate();
})();
