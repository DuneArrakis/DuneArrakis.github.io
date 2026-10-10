(() => {
  "use strict";

  // Scroll the whole table so column headings and cells stay aligned.
  document.querySelectorAll(".content table").forEach((table) => {
    const scroller = document.createElement("div");
    scroller.className = "table-scroll";
    scroller.tabIndex = 0;
    scroller.setAttribute("role", "region");
    scroller.setAttribute("aria-label", "表格，可左右滑动查看");
    table.before(scroller);
    scroller.append(table);
  });

  const checkbox = document.getElementById("sidebar-checkbox");
  const sidebar = document.getElementById("sidebar");
  const label = document.querySelector(".sidebar-toggle");
  const wrap = document.querySelector(".wrap");
  if (!checkbox || !sidebar || !label || !wrap) return;

  const mobile = window.matchMedia("(max-width: 767px)");
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = label.className;
  toggle.setAttribute("aria-controls", "sidebar");
  label.replaceWith(toggle);

  const backdrop = document.createElement("button");
  backdrop.type = "button";
  backdrop.className = "sidebar-backdrop";
  backdrop.tabIndex = -1;
  backdrop.setAttribute("aria-label", "关闭导航菜单");
  backdrop.hidden = true;
  document.body.append(backdrop);

  const search = document.getElementById("sidebar-search-input");
  if (search) search.setAttribute("aria-label", "搜索博文");

  function sync() {
    const open = checkbox.checked;
    const modal = mobile.matches && open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "关闭导航菜单" : "打开导航菜单");
    sidebar.inert = !open;
    sidebar.setAttribute("aria-hidden", String(!open));
    wrap.inert = modal;
    backdrop.hidden = !modal;
    document.documentElement.classList.toggle("mobile-menu-open", modal);
  }

  function close(restoreFocus = true) {
    checkbox.checked = false;
    sync();
    if (restoreFocus) toggle.focus({ preventScroll: true });
  }

  // Archive/tag pages request an open sidebar on desktop only.
  if (mobile.matches) checkbox.checked = false;
  sync();
  checkbox.addEventListener("change", sync);
  toggle.addEventListener("click", () => {
    checkbox.checked = !checkbox.checked;
    sync();
  });
  backdrop.addEventListener("click", () => close());
  sidebar.addEventListener("click", (event) => {
    if (mobile.matches && event.target.closest("a")) close();
  });
  mobile.addEventListener("change", () => {
    if (mobile.matches) close(false);
    else sync();
  });

  document.addEventListener("keydown", (event) => {
    if (!checkbox.checked) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
    if (event.key !== "Tab" || !mobile.matches) return;
    const focusable = [...sidebar.querySelectorAll("a[href], input, button, [tabindex='0']")]
      .filter((element) => !element.disabled && element.getClientRects().length);
    focusable.push(toggle);
    const first = focusable[0];
    const last = toggle;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
})();
