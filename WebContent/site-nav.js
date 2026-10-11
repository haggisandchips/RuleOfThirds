// Shared navigation for the extension's own HTML pages (About, Guide, Site Compatibility,
// Options, Version History) - on wide viewports a sidebar that sits immediately beside the
// page content (the two centre together as one block - see style.css's body flex layout
// under the --site-nav-width media query, not a sidebar pinned to the literal browser edge
// with content centred independently of it), on narrow ones a top bar. Also carries a Ko-fi
// link on every page, not just something you stumble onto by landing on About specifically.
// A single source of truth for the page list, instead of hand-copied <nav> markup pasted
// into every file that would drift as pages are added, renamed or reordered.
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
        {id: 'history', title: 'Version History', path: 'versions/history.html'},
        // The one functional (not informational) page here - set apart with a separator
        // line, rather than just its position at the end, so it still reads as distinct
        // even where position alone wouldn't (eg a top-bar layout that's wrapped onto
        // several lines).
        {id: 'options', title: 'Options', path: 'options/options.html', separatorBefore: true}
    ];

    const DONATE_URL = 'https://ko-fi.com/ivorpotter';

    const currentPage = document.currentScript.dataset.page;

    const links = PAGES.map(page => {
        const current = page.id === currentPage;
        const separator = page.separatorBefore ? '<span class="site-nav-separator" aria-hidden="true"></span>' : '';
        return `${separator}<a href="${chrome.runtime.getURL(page.path)}"${current ? ' aria-current="page"' : ''}>${page.title}</a>`;
    }).join('');

    document.currentScript.insertAdjacentHTML('afterend', `
        <nav class="site-nav">
            <div class="site-nav-inner">
                <span class="site-nav-brand">Rule of Thirds</span>
                <div class="site-nav-links">${links}</div>
                <div class="site-nav-donate">
                    <p class="site-nav-donate-text">Enjoying the extension?</p>
                    <a class="site-nav-donate-btn" href="${DONATE_URL}" target="_blank" rel="noopener">&#9749; Support on Ko-fi</a>
                </div>
            </div>
        </nav>
    `);
})();
