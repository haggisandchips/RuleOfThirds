// Shared top navigation for the extension's own HTML pages (Guide, About, Site
// Compatibility, Options, Version History) - a single source of truth for the page list,
// instead of hand-copied <nav> markup pasted into every file that would drift as pages are
// added, renamed or reordered.
//
// Each page includes this as the first element inside <body>, before its own content, via
// <script src="../site-nav.js" data-page="..."></script> - document.currentScript still
// refers to that tag while this file runs (a plain, non-async/non-deferred external script
// always executes before the parser moves on), so its data-page attribute says which entry
// below is "this page", and insertAdjacentHTML('afterend', ...) drops the rendered <nav>
// immediately after it, ahead of everything else in <body>, without needing to wait for the
// rest of the page to load first.
//
// Hrefs are resolved with chrome.runtime.getURL() rather than written as relative paths, so
// this one file works unmodified regardless of which subdirectory the including page lives
// in (every page here is one level under WebContent/, but nothing here needs to assume that).
(function () {

    const PAGES = [
        {id: 'about', title: 'About', path: 'guide/about.html'},
        {id: 'guide', title: 'Guide', path: 'guide/guide.html'},
        {id: 'compatibility', title: 'Site Compatibility', path: 'guide/compatibility.html'},
        {id: 'options', title: 'Options', path: 'options/options.html'},
        {id: 'history', title: 'Version History', path: 'versions/history.html'}
    ];

    const currentPage = document.currentScript.dataset.page;

    const links = PAGES.map(page => {
        const current = page.id === currentPage;
        return `<a href="${chrome.runtime.getURL(page.path)}"${current ? ' aria-current="page"' : ''}>${page.title}</a>`;
    }).join('');

    document.currentScript.insertAdjacentHTML('afterend', `
        <nav class="site-nav">
            <div class="site-nav-inner">
                <span class="site-nav-brand">Rule of Thirds</span>
                <div class="site-nav-links">${links}</div>
            </div>
        </nav>
    `);
})();
