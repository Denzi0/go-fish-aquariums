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

  /* Sort sits outside the filter form; carry it through so filters keep the sort. */
  var sortSelect = $('[data-sort-select]');
  if (sortSelect) {
    sortSelect.addEventListener('change', function () {
      var mirror = filterForm && $('[data-sort-mirror]', filterForm);
      if (mirror) {
        mirror.value = sortSelect.value;
        filterForm.submit();
      } else {
        var url = new URL(window.location.href);
        url.searchParams.set('sort_by', sortSelect.value);
        url.searchParams.delete('page');
        window.location.href = url.toString();
      }
    });
  }

  /* Phones: filters open as a drawer from the toolbar button. */
  var filtersPanel = $('[data-filters]');
  if (filtersPanel) {
    var filterButtons = $$('[data-filters-toggle]');
    var setFilters = function (open) {
      filtersPanel.classList.toggle('is-open', open);
      document.documentElement.classList.toggle('gfa-lock', open);
      filterButtons.forEach(function (b) {
        if (b.hasAttribute('aria-expanded')) b.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    };
    filterButtons.forEach(function (b) {
      b.addEventListener('click', function () { setFilters(!filtersPanel.classList.contains('is-open')); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && filtersPanel.classList.contains('is-open')) setFilters(false);
    });
    document.addEventListener('click', function (e) {
      if (!filtersPanel.classList.contains('is-open')) return;
      if (filtersPanel.contains(e.target) || e.target.closest('[data-filters-toggle]')) return;
      setFilters(false);
    });
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

  /* --- Enquiry → B2B application handoff ---------------------------------- */
  /* Details typed into an enquiry form are kept for this tab only, so the B2B
     application can be prefilled when the visitor follows "Register here". */
  var ENQUIRY_KEY = 'gfa-enquiry';
  document.addEventListener('submit', function (e) {
    var fields = $$('[data-enquiry-field]', e.target);
    if (!fields.length) return;
    var data = {};
    fields.forEach(function (f) { if (f.value) data[f.getAttribute('data-enquiry-field')] = f.value; });
    try { sessionStorage.setItem(ENQUIRY_KEY, JSON.stringify(data)); } catch (err) {}
  });

  var prefill = $$('[data-prefill]');
  if (prefill.length) {
    var saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(ENQUIRY_KEY) || 'null'); } catch (err) {}
    if (saved) {
      prefill.forEach(function (f) {
        var v = saved[f.getAttribute('data-prefill')];
        if (v && !f.value) f.value = v;
      });
    }
  }

  /* --- Product enquiry popup --------------------------------------------- */
  /* One dialog for the whole site. Each [data-enquiry-open] button carries its
     product's title, link, SKU and options; they are copied into the form. The
     product is also kept for this tab so the popup can reopen with the right
     product after Shopify reloads the page with errors or the thank-you. */
  var PRODUCT_KEY = 'gfa-enquiry-product';
  var enquiry = $('[data-enquiry-dialog]');

  function fillEnquiry(p) {
    if (!enquiry || !p) return;
    var title = $('[data-enquiry-title]', enquiry);
    if (title) title.textContent = p.product || '';
    var about = $('[data-enquiry-done-product]', enquiry);
    if (about && p.product) { about.textContent = p.product; about.hidden = false; }
    ['product', 'url', 'sku'].forEach(function (k) {
      var input = $('[data-enquiry-input="' + k + '"]', enquiry);
      if (input) input.value = p[k] || '';
    });

    var row = $('[data-enquiry-option-row]', enquiry);
    var select = $('[data-enquiry-options]', enquiry);
    if (!row || !select) return;
    var options = p.options ? p.options.split('||') : [];
    select.innerHTML = '';
    options.forEach(function (text) {
      var opt = document.createElement('option');
      opt.textContent = text;
      if (text === p.selected) opt.selected = true;
      select.appendChild(opt);
    });
    var label = $('[data-enquiry-option-label]', enquiry);
    if (label && p.optionLabel) label.textContent = p.optionLabel;
    row.hidden = options.length === 0;
    select.disabled = options.length === 0;
  }

  function openEnquiry(p) {
    if (!enquiry || typeof enquiry.showModal !== 'function') return false;
    if (p) fillEnquiry(p);
    var quick = $('[data-quick-view-dialog]');
    if (quick && quick.open) quick.close();
    if (!enquiry.open) enquiry.showModal();
    var first = $('[data-enquiry-done]', enquiry) || $('[data-enquiry-field="name"]', enquiry);
    if (first) first.focus();
    return true;
  }

  function productFrom(btn) {
    return {
      product: btn.getAttribute('data-product'),
      url: btn.getAttribute('data-url'),
      sku: btn.getAttribute('data-sku'),
      options: btn.getAttribute('data-options'),
      selected: btn.getAttribute('data-selected'),
      optionLabel: btn.getAttribute('data-option-label')
    };
  }

  if (enquiry) {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-enquiry-open]');
      if (!btn) return;
      if (openEnquiry(productFrom(btn))) e.preventDefault();
    });
    $('[data-enquiry-close]', enquiry).addEventListener('click', function () { enquiry.close(); });
    enquiry.addEventListener('click', function (e) { if (e.target === enquiry) enquiry.close(); });

    var enquiryForm = $('form', enquiry);
    if (enquiryForm) {
      enquiryForm.addEventListener('submit', function () {
        var p = {
          product: ($('[data-enquiry-input="product"]', enquiry) || {}).value,
          url: ($('[data-enquiry-input="url"]', enquiry) || {}).value,
          sku: ($('[data-enquiry-input="sku"]', enquiry) || {}).value
        };
        var trigger = $$('[data-enquiry-open]').filter(function (b) { return b.getAttribute('data-url') === p.url; })[0];
        if (trigger) p = productFrom(trigger);
        try { sessionStorage.setItem(PRODUCT_KEY, JSON.stringify(p)); } catch (err) {}
      });
    }

    var saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(PRODUCT_KEY) || 'null'); } catch (err) {}
    var hash = window.location.hash;
    if ($('[data-enquiry-done]', enquiry) || $('[data-enquiry-errors]', enquiry) || hash === '#ProductEnquiry') {
      /* Back from a post: reopen with the product that was asked about. */
      openEnquiry(saved);
    } else if (hash === '#enquire') {
      /* Arrived from a card link without JS having run (or a shared link). */
      var primary = $('[data-enquiry-primary]');
      if (primary) openEnquiry(productFrom(primary));
    }
  }

  /* Contact and B2B pages: after Shopify reloads, bring the thank-you into view. */
  var pageDone = $$('[data-enquiry-done]').filter(function (d) { return !d.closest('dialog'); })[0];
  if (pageDone) {
    pageDone.scrollIntoView({ block: 'center' });
    pageDone.focus({ preventScroll: true });
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

  /* --- Horizontal chip scroller (blog topics) ------------------------------
     Arrows, wheel-to-sideways and drag for mouse users; touch scrolls natively. */
  $$('[data-scroller]').forEach(function (bar) {
    var track = $('[data-scroller-track]', bar);
    var prev = $('[data-scroller-prev]', bar);
    var next = $('[data-scroller-next]', bar);
    if (!track) return;

    function update() {
      var max = track.scrollWidth - track.clientWidth;
      var canPrev = track.scrollLeft > 2;
      var canNext = track.scrollLeft < max - 2;
      bar.classList.toggle('can-prev', canPrev);
      bar.classList.toggle('can-next', canNext);
      if (prev) prev.hidden = !canPrev;
      if (next) next.hidden = !canNext;
    }

    function page(direction) {
      track.scrollBy({ left: direction * track.clientWidth * 0.7, behavior: 'smooth' });
    }
    if (prev) prev.addEventListener('click', function () { page(-1); });
    if (next) next.addEventListener('click', function () { page(1); });

    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);

    /* Vertical wheel moves the row sideways, but only while there is room,
       so the page still scrolls once the row hits either end. */
    track.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      var max = track.scrollWidth - track.clientWidth;
      if (max <= 0) return;
      if ((e.deltaY < 0 && track.scrollLeft <= 0) || (e.deltaY > 0 && track.scrollLeft >= max)) return;
      e.preventDefault();
      track.scrollLeft += e.deltaY;
    }, { passive: false });

    var startX = 0;
    var startLeft = 0;
    var dragging = false;
    track.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      startX = e.clientX;
      startLeft = track.scrollLeft;
      dragging = false;
      function move(ev) {
        var dx = ev.clientX - startX;
        if (!dragging && Math.abs(dx) > 5) {
          dragging = true;
          track.classList.add('is-dragging');
        }
        if (dragging) track.scrollLeft = startLeft - dx;
      }
      function up() {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        /* Let the click that ends a drag fire on nothing, then re-enable links. */
        setTimeout(function () { track.classList.remove('is-dragging'); }, 0);
      }
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    });
    track.addEventListener('dragstart', function (e) { e.preventDefault(); });

    var active = $('.is-active', track);
    if (active && active.offsetLeft + active.offsetWidth > track.clientWidth) {
      track.style.scrollBehavior = 'auto';
      track.scrollLeft = active.offsetLeft - track.clientWidth / 2 + active.offsetWidth / 2;
      track.style.scrollBehavior = '';
    }
    update();
  });

  /* Stockists: live search, state filter and a shared map panel. */
  $$('[data-stockists]').forEach(function (root) {
    var input = $('[data-stockists-search]', root);
    var clear = $('[data-stockists-clear]', root);
    var items = $$('[data-stockist]', root);
    var stateBtns = $$('[data-stockists-state]', root);
    var count = $('[data-stockists-count]', root);
    var empty = $('[data-stockists-empty]', root);
    var list = $('[data-stockists-list]', root);
    var map = $('[data-stockists-map]', root);
    var mapName = $('[data-stockists-map-name]', root);
    var state = 'all';

    var run = function () {
      var term = input.value.trim().toLowerCase();
      var words = term.split(/\s+/).filter(Boolean);
      var shown = 0;
      items.forEach(function (item) {
        var hay = item.getAttribute('data-search');
        var match = (state === 'all' || item.getAttribute('data-state') === state) &&
          words.every(function (w) { return hay.indexOf(w) !== -1; });
        item.hidden = !match;
        if (match) shown++;
      });
      count.innerHTML = 'Showing <b class="gfa-num">' + shown + '</b> ' + (shown === 1 ? 'stockist' : 'stockists');
      clear.hidden = !term;
      empty.hidden = shown > 0;
      list.hidden = shown === 0;
      if (shown === 0) $('[data-stockists-term]', empty).textContent = input.value.trim() || state;
    };

    input.addEventListener('input', run);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && input.value) { input.value = ''; run(); }
    });
    clear.addEventListener('click', function () { input.value = ''; run(); input.focus(); });
    $('[data-stockists-reset]', root).addEventListener('click', function () {
      input.value = '';
      stateBtns.forEach(function (b) { if (b.getAttribute('data-stockists-state') === 'all') b.click(); });
      run();
      input.focus();
    });

    stateBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        state = btn.getAttribute('data-stockists-state');
        stateBtns.forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        run();
      });
    });

    /* Long descriptions are clamped; offer Read more only where text is cut off. */
    items.forEach(function (item) {
      var desc = $('[data-stockist-desc]', item);
      var more = $('[data-stockist-more]', item);
      if (!desc || !more) return;
      if (desc.scrollHeight > desc.clientHeight + 2) more.hidden = false;
      more.addEventListener('click', function () {
        var open = item.classList.toggle('is-expanded');
        more.setAttribute('aria-expanded', open ? 'true' : 'false');
        more.textContent = open ? 'Show less' : 'Read more';
      });
    });

    if (map) {
      var current = items.filter(function (i) { return i.hasAttribute('data-map'); })[0];
      if (current && map.offsetParent !== null) current.classList.add('is-current');
      root.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-stockist-show]');
        if (!btn) return;
        var item = btn.closest('[data-stockist]');
        map.src = 'https://maps.google.com/maps?q=' + item.getAttribute('data-map') + '&z=14&output=embed';
        var name = $('.gfa-stockist__name', item).textContent;
        map.title = 'Map showing ' + name;
        mapName.textContent = name;
        if (current) current.classList.remove('is-current');
        current = item;
        item.classList.add('is-current');
      });
    }

    var q = new URLSearchParams(window.location.search).get('q');
    if (q) { input.value = q; run(); }
  });
})();
