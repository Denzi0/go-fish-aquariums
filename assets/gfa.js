/* GoFishAquariums — theme behaviour. Vanilla JS, no dependencies.
   Everything here degrades to a working server-rendered form if JS fails. */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* --- Quantity stepper, respecting min and bag increments ---------------- */
  function stepQty(wrap, direction) {
    var input = $('input', wrap);
    if (!input) return;
    var step = parseInt(input.step, 10) || 1;
    var min = parseInt(input.min, 10) || 1;
    var max = input.max ? parseInt(input.max, 10) : Infinity;
    var next = (parseInt(input.value, 10) || min) + direction * step;
    input.value = Math.min(max, Math.max(min, next));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  document.addEventListener('click', function (e) {
    var down = e.target.closest('[data-qty-down]');
    var up = e.target.closest('[data-qty-up]');
    if (down) stepQty(down.closest('[data-qty]'), -1);
    if (up) stepQty(up.closest('[data-qty]'), 1);
  });

  /* Snap typed values up to the next whole bag. */
  document.addEventListener('change', function (e) {
    if (!e.target.matches('[data-qty] input')) return;
    var input = e.target;
    var step = parseInt(input.step, 10) || 1;
    var min = parseInt(input.min, 10) || 1;
    var value = parseInt(input.value, 10) || min;
    if (value < min) value = min;
    if (step > 1 && value % step !== 0) value = Math.ceil(value / step) * step;
    input.value = value;
  });

  /* --- Add to order ------------------------------------------------------- */
  function setCartCount(count) {
    $$('[data-cart-count]').forEach(function (el) { el.textContent = count; });
  }

  function flash(button, text) {
    var original = button.dataset.label || button.textContent;
    button.dataset.label = original;
    button.textContent = text;
    button.disabled = true;
    setTimeout(function () {
      button.textContent = original;
      button.disabled = false;
    }, 1600);
  }

  document.addEventListener('submit', function (e) {
    var form = e.target.closest('[data-add-to-order]');
    if (!form) return;
    e.preventDefault();

    var button = $('button[type="submit"]', form);
    var body = new FormData(form);

    fetch(window.Shopify && window.Shopify.routes ? window.Shopify.routes.root + 'cart/add.js' : '/cart/add.js', {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: body
    })
      .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.data.description || 'Could not add to order');
        flash(button, 'Added');
        return fetch('/cart.js', { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); });
      })
      .then(function (cart) { if (cart) setCartCount(cart.item_count); })
      .catch(function (err) {
        flash(button, 'Not added');
        console.error('[GoFish]', err.message);
      });
  });

  /* --- Grid / list view, remembered per buyer ----------------------------- */
  function applyView(view) {
    $$('[data-product-grid]').forEach(function (grid) { grid.setAttribute('data-view', view); });
    $$('[data-view-toggle] button').forEach(function (btn) {
      var active = btn.dataset.view === view;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  var toggle = $('[data-view-toggle]');
  if (toggle) {
    var saved = 'grid';
    try { saved = localStorage.getItem('gfa-view') || 'grid'; } catch (err) { /* private mode */ }
    applyView(saved);
    toggle.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-view]');
      if (!btn) return;
      applyView(btn.dataset.view);
      try { localStorage.setItem('gfa-view', btn.dataset.view); } catch (err) { /* ignore */ }
    });
  }

  /* --- Filters: submit on change ------------------------------------------ */
  var filterForm = $('#gfa-filter-form');
  if (filterForm) {
    filterForm.addEventListener('change', function () { filterForm.submit(); });
  }

  /* --- Dropdown menus ------------------------------------------------------ */
  function closeMenus(except) {
    $$('[data-menu-btn]').forEach(function (btn) {
      if (btn === except) return;
      btn.setAttribute('aria-expanded', 'false');
      var panel = btn.parentNode.querySelector('[data-menu-panel]');
      if (panel) panel.hidden = true;
    });
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-menu-btn]');
    if (!btn) {
      if (!e.target.closest('[data-menu-panel]')) closeMenus();
      return;
    }
    var panel = btn.parentNode.querySelector('[data-menu-panel]');
    var open = btn.getAttribute('aria-expanded') === 'true';
    closeMenus(btn);
    btn.setAttribute('aria-expanded', open ? 'false' : 'true');
    if (panel) panel.hidden = open;
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var open = $('[data-menu-btn][aria-expanded="true"]');
    closeMenus();
    if (open) open.focus();
  });

  /* Open on hover for pointer devices, without breaking click or keyboard. */
  if (window.matchMedia('(hover: hover) and (min-width: 901px)').matches) {
    $$('.gfa-nav__item').forEach(function (item) {
      var btn = $('[data-menu-btn]', item);
      var panel = $('[data-menu-panel]', item);
      if (!btn || !panel) return;
      var timer;
      item.addEventListener('mouseenter', function () {
        clearTimeout(timer);
        closeMenus(btn);
        btn.setAttribute('aria-expanded', 'true');
        panel.hidden = false;
      });
      item.addEventListener('mouseleave', function () {
        timer = setTimeout(function () {
          btn.setAttribute('aria-expanded', 'false');
          panel.hidden = true;
        }, 120);
      });
    });
  }

  /* --- Variant pickers ----------------------------------------------------- */
  /* On a card: swap the variant ID and price in place, no page load. */
  document.addEventListener('change', function (e) {
    var select = e.target.closest('[data-card-variant]');
    if (!select) return;
    var card = select.closest('[data-fish-card]');
    var option = select.options[select.selectedIndex];
    var idField = $('[data-variant-id]', card);
    var price = $('[data-card-price]', card);
    var submit = $('button[type="submit"]', card);

    if (idField) idField.value = select.value;
    if (price && option.dataset.price) price.textContent = option.dataset.price;
    if (submit) submit.disabled = option.dataset.available === 'false';
  });

  /* On the product page: reload on ?variant= so price breaks, stock counts and
     quantity rules all come back from Liquid rather than being patched here. */
  var productSelect = $('[data-variant-select]');
  if (productSelect) {
    productSelect.addEventListener('change', function () {
      var url = new URL(window.location.href);
      url.searchParams.set('variant', productSelect.value);
      window.location.href = url.toString();
    });
  }

  /* --- Mobile navigation --------------------------------------------------- */
  var menuBtn = $('[data-menu-toggle]');
  if (menuBtn) {
    menuBtn.addEventListener('click', function () {
      var panel = document.getElementById(menuBtn.getAttribute('aria-controls'));
      var open = menuBtn.getAttribute('aria-expanded') === 'true';
      menuBtn.setAttribute('aria-expanded', open ? 'false' : 'true');
      panel.hidden = open;
    });
  }

  /* --- Search dialog with predictive results ------------------------------- */
  var search = $('[data-search-dialog]');
  if (search && typeof search.showModal === 'function') {
    var searchInput = $('[data-search-input]', search);
    var results = $('[data-search-results]', search);
    var searchTimer, searchRequest = 0;

    var openSearch = function () {
      closeMenus();
      if (!search.open) search.showModal();
      searchInput.focus();
      searchInput.select();
    };

    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-search-open]')) { e.preventDefault(); openSearch(); }
    });
    $('[data-search-close]', search).addEventListener('click', function () { search.close(); });
    search.addEventListener('click', function (e) { if (e.target === search) search.close(); });

    /* "/" opens search from anywhere, unless the buyer is already typing. */
    document.addEventListener('keydown', function (e) {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      e.preventDefault();
      openSearch();
    });

    var el = function (tag, className, text) {
      var node = document.createElement(tag);
      if (className) node.className = className;
      if (text) node.textContent = text;
      return node;
    };

    var renderResults = function (term, products) {
      results.innerHTML = '';
      if (!products.length) {
        results.appendChild(el('p', null, results.dataset.empty));
      } else {
        var list = el('ul');
        products.forEach(function (p) {
          var link = el('a', 'gfa-search__item');
          link.href = p.url;
          if (p.featured_image && p.featured_image.url) {
            var img = el('img');
            img.src = p.featured_image.url + (p.featured_image.url.indexOf('?') > -1 ? '&' : '?') + 'width=96';
            img.alt = '';
            img.loading = 'lazy';
            link.appendChild(img);
          } else {
            link.appendChild(el('span', 'gfa-search__thumb'));
          }
          var text = el('span', null, p.title);
          if (p.type) text.appendChild(el('small', null, p.type));
          link.appendChild(text);
          var li = el('li');
          li.appendChild(link);
          list.appendChild(li);
        });
        results.appendChild(list);
      }
      var all = el('a', 'gfa-search__all', results.dataset.all + ' “' + term + '”');
      all.href = search.querySelector('form').action + '?type=product&options%5Bprefix%5D=last&q=' + encodeURIComponent(term);
      results.appendChild(all);
    };

    searchInput.addEventListener('input', function () {
      clearTimeout(searchTimer);
      var term = searchInput.value.trim();
      if (term.length < 2) { results.innerHTML = ''; return; }
      searchTimer = setTimeout(function () {
        var id = ++searchRequest;
        fetch(results.dataset.url + '.json?q=' + encodeURIComponent(term) +
              '&resources[type]=product&resources[limit]=6&resources[options][fields]=title,product_type,variants.sku,tag',
              { headers: { Accept: 'application/json' } })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (id !== searchRequest) return; /* a newer search has started */
            renderResults(term, (data.resources && data.resources.results.products) || []);
          })
          .catch(function () { if (id === searchRequest) results.innerHTML = ''; });
      }, 180);
    });
  }

  /* --- Quick view ---------------------------------------------------------- */
  var dialog = $('[data-quick-view-dialog]');
  if (dialog && typeof dialog.showModal === 'function') {
    document.addEventListener('click', function (e) {
      var trigger = e.target.closest('[data-quick-view]');
      if (!trigger) return;
      e.preventDefault();
      var body = $('[data-quick-view-body]', dialog);
      body.innerHTML = '<p class="gfa-note" style="padding:24px">Loading…</p>';
      dialog.showModal();

      fetch(trigger.dataset.quickView + '?view=quick')
        .then(function (r) { return r.text(); })
        .then(function (html) {
          var doc = new DOMParser().parseFromString(html, 'text/html');
          var content = doc.querySelector('.gfa-product');
          body.innerHTML = content ? content.innerHTML : '<p class="gfa-note" style="padding:24px">Open the product page for full details.</p>';
        })
        .catch(function () {
          body.innerHTML = '<p class="gfa-note" style="padding:24px">Could not load this one. Open the product page instead.</p>';
        });
    });

    $('[data-quick-view-close]', dialog).addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
  }

  /* --- Quick order: paste a list, add it all at once ----------------------- */
  var quickBtn = $('[data-quick-order-submit]');
  if (quickBtn) {
    quickBtn.addEventListener('click', function () {
      var input = $('[data-quick-order-input]');
      var status = $('[data-quick-order-status]');
      var lines = input.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      if (!lines.length) { status.textContent = 'Add at least one line first.'; return; }

      status.textContent = 'Looking up ' + lines.length + ' codes…';

      var lookups = lines.map(function (line) {
        var parts = line.split(/[,\t]+/);
        var code = (parts[0] || '').trim();
        var qty = parseInt(parts[1], 10) || 1;
        return fetch('/search/suggest.json?q=' + encodeURIComponent(code) + '&resources[type]=product&resources[limit]=1')
          .then(function (r) { return r.json(); })
          .then(function (data) {
            var product = data.resources.results.products[0];
            if (!product || !product.variants || !product.variants.length) return { code: code, missing: true };
            return { id: product.variants[0].id, quantity: qty, code: code };
          })
          .catch(function () { return { code: code, missing: true }; });
      });

      Promise.all(lookups).then(function (results) {
        var found = results.filter(function (r) { return !r.missing; });
        var missing = results.filter(function (r) { return r.missing; });
        if (!found.length) { status.textContent = 'No matching product codes. Check the codes and try again.'; return; }

        fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ items: found.map(function (f) { return { id: f.id, quantity: f.quantity }; }) })
        })
          .then(function (r) { return r.json(); })
          .then(function () {
            status.textContent = found.length + ' lines added to your order' +
              (missing.length ? '. Not found: ' + missing.map(function (m) { return m.code; }).join(', ') : '.');
            return fetch('/cart.js').then(function (r) { return r.json(); });
          })
          .then(function (cart) { setCartCount(cart.item_count); })
          .catch(function () { status.textContent = 'Could not add those lines. Try again or call the office.'; });
      });
    });
  }
})();
