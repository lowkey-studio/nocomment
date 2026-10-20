/* kit.js: theme toggle and copy buttons for kit.css. No dependencies, no network.
   Theme: <button data-theme-toggle> flips light and dark and remembers the choice; with no choice the OS decides.
   Copy: <button data-copy="literal text">, or data-copy="" inside a .code block (copies its <pre>),
   or data-copy-target="#id" (copies that element's value or text). Elements with .c-prompt or data-nocopy are skipped.
   Scroll: any <pre> or .table-wrap that scrolls sideways gets tabindex="0" so keyboard users can scroll it.
   After your own script renders a table or code block, call window.kit.refresh(). */
(function () {
  var root = document.documentElement, KEY = 'kit-theme', live;
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function isDark() {
    var t = root.getAttribute('data-theme');
    return t ? t === 'dark' : !!(media && media.matches);
  }
  function label() {
    var next = isDark() ? 'light' : 'dark';
    document.querySelectorAll('[data-theme-toggle]').forEach(function (b) {
      b.setAttribute('aria-label', 'Switch to ' + next + ' theme');
      b.setAttribute('title', 'Switch to ' + next + ' theme');
    });
  }
  function announce(msg) {
    if (!live) {
      live = document.createElement('div');
      live.className = 'sr-only';
      live.setAttribute('aria-live', 'polite');
      document.body.appendChild(live);
    }
    live.textContent = '';
    setTimeout(function () { live.textContent = msg; }, 30);
  }
  function textOf(el) {
    if (!el) return '';
    if ('value' in el && typeof el.value === 'string' && el.tagName !== 'BUTTON') return el.value;
    var clone = el.cloneNode(true);
    clone.querySelectorAll('.c-prompt,[data-nocopy]').forEach(function (n) { n.remove(); });
    return clone.textContent;
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    ta.remove();
    return ok ? Promise.resolve() : Promise.reject();
  }
  function copy(btn) {
    var text = btn.getAttribute('data-copy');
    if (!text) {
      var sel = btn.getAttribute('data-copy-target');
      var block = btn.closest('.code');
      text = textOf(sel ? document.querySelector(sel) : block && block.querySelector('pre'));
    }
    text = (text || '').replace(/\s+$/, '');
    var done = function () {
      btn.setAttribute('data-copied', '');
      announce('Copied');
      clearTimeout(btn._kitTimer);
      btn._kitTimer = setTimeout(function () { btn.removeAttribute('data-copied'); }, 2000);
    };
    var p = navigator.clipboard && window.isSecureContext
      ? navigator.clipboard.writeText(text).catch(function () { return fallbackCopy(text); })
      : fallbackCopy(text);
    p.then(done, function () { announce('Copy failed. Select the text and copy it by hand.'); });
  }

  function refresh() {
    document.querySelectorAll('pre, .table-wrap').forEach(function (el) {
      var scrolls = el.scrollWidth > el.clientWidth + 1;
      if (scrolls && !el.hasAttribute('tabindex')) { el.setAttribute('tabindex', '0'); el.setAttribute('data-kit-tab', ''); }
      else if (!scrolls && el.hasAttribute('data-kit-tab')) { el.removeAttribute('tabindex'); el.removeAttribute('data-kit-tab'); }
    });
  }
  window.kit = { refresh: refresh };
  var resizeTimer;
  window.addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(refresh, 150); });
  window.addEventListener('load', refresh);

  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-theme-toggle]');
    if (t) {
      var next = isDark() ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem(KEY, next); } catch (err) {}
      label();
      return;
    }
    var c = e.target.closest && e.target.closest('[data-copy],[data-copy-target]');
    if (c) { e.preventDefault(); copy(c); }
  });

  if (media && media.addEventListener) media.addEventListener('change', label);
  function ready() { label(); refresh(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();
