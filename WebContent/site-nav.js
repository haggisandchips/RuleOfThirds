

(function () {
    const PAGES = [
        {id: 'about', title: 'About', path: 'guide/about.html'},
        {id: 'guide', title: 'Guide', path: 'guide/guide.html'},
        {id: 'compatibility', title: 'Site Compatibility', path: 'guide/compatibility.html'},
        {id: 'history', title: 'Version History', path: 'versions/history.html'},

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
                    <a class="site-nav-donate-btn" href="${DONATE_URL}" target="_blank" rel="noopener">&#9749; Buy Me A Coffee</a>
                </div>
            </div>
        </nav>
    `);
})();
