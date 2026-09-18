(() => {
    // Match backend session timeout.
    // Untuk PM demo: 60 minit.
    // Kalau nak test cepat, temporary tukar ke 2 * 60 * 1000.
    const IDLE_TIMEOUT_MS = 2 * 60 * 1000;

    let idleTimer = null;
    let redirecting = false;

    const rawFetch = window.fetch.bind(window);

    function clearUserSession() {
        sessionStorage.removeItem('userId');
        sessionStorage.removeItem('username');
        sessionStorage.removeItem('position');
        sessionStorage.removeItem('department');
    }

    async function expireSession() {
        if (redirecting) return;

        redirecting = true;

        try {
            await rawFetch('/api/logout', {
                method: 'POST'
            });
        } catch (error) {
            // Session may already be expired.
        }

        clearUserSession();

        window.location.replace('/index.html?expired=1');
    }

    function resetIdleTimer() {
        clearTimeout(idleTimer);

        idleTimer = setTimeout(
            expireSession,
            IDLE_TIMEOUT_MS
        );
    }

    // Catch backend session expiry immediately whenever an API is called.
    window.fetch = async (...args) => {
        const response = await rawFetch(...args);

        if (response.status === 401) {
            expireSession();
        }

        return response;
    };

    [
        'click',
        'keydown',
        'mousemove',
        'scroll',
        'touchstart'
    ].forEach(eventName => {
        window.addEventListener(
            eventName,
            resetIdleTimer,
            { passive: true }
        );
    });

    resetIdleTimer();
})();