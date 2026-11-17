// ハンバーガーで開くメニューの開閉と、file: で開いたときのリンク補正。
const rootElement = document.documentElement;
const navToggleButton = document.querySelector('[data-nav-toggle]');
const navCloseButton = document.querySelector('[data-nav-close]');
const navScrim = document.querySelector('[data-nav-scrim]');
const siteNav = document.querySelector('#site-nav');

if (navToggleButton && navCloseButton && navScrim && siteNav) {
  const openNav = () => {
    rootElement.setAttribute('data-nav-open', '');
    navToggleButton.setAttribute('aria-expanded', 'true');
    navCloseButton.focus();
  };

  const closeNav = (shouldRestoreFocus = true) => {
    if (!rootElement.hasAttribute('data-nav-open')) return;
    rootElement.removeAttribute('data-nav-open');
    navToggleButton.setAttribute('aria-expanded', 'false');
    if (shouldRestoreFocus) navToggleButton.focus();
  };

  navToggleButton.addEventListener('click', openNav);
  navCloseButton.addEventListener('click', () => closeNav());
  navScrim.addEventListener('click', () => closeNav());

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeNav();
    }
  });

  siteNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => closeNav(false));
  });

  // 広い幅へ戻したときは、開いた状態を残さない。
  window.matchMedia('(min-width: 691px)').addEventListener('change', (event) => {
    if (event.matches) closeNav(false);
  });
}

// file: で開いたときは、ディレクトリへのリンクを index.html へ向ける。
if (location.protocol === 'file:') {
  document.querySelectorAll('a[href]').forEach((link) => {
    const href = link.getAttribute('href');
    const isRelative = href && !/^[a-z][a-z0-9+.-]*:/i.test(href) && !href.startsWith('#');
    if (isRelative && href.endsWith('/')) {
      link.setAttribute('href', `${href}index.html`);
    }
  });
}
