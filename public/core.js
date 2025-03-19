(function () {

    // If navigating to the same page, don't re-run
    const startTime = new Date().getTime() / 1000;
    let currentPage = window.location.pathname;
    if (document._ABCurrentPage === currentPage) return;
    document._ABCurrentPage = currentPage;
    console.log("Initializing AB test script...")
    let SESSION_KEY = 'dalton_session';
    let DEVICE_KEY = "dalton_device"
    const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

    const queryString = window.location.search;
    const urlParams2 = new URLSearchParams(queryString);
    let debugMode = parseInt(urlParams2.get('debug_mode') || 0);
    let demoMode = parseInt(urlParams2.get('demo_mode') || 0);
    let slowDown = parseInt(urlParams2.get('slow') || 0);
    const forceIds = urlParams2.get("ids")?.split('-').map(id => parseInt(id));
    let noTracking = parseInt(urlParams2.get('disable_tracking')) || 0;
    const scriptUrl = document.currentScript.src;
    const urlParams = new URLSearchParams(new URL(scriptUrl).search);
    const customerId = parseInt(urlParams.get("customer_id"));

    const sampleRate = parseFloat(urlParams.get("sample"));

    SESSION_KEY += `_${urlParams.get("customer_id")}`;
    let sessionId = null;

    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return JSON.parse(decodeURIComponent(parts.pop().split(';').shift()));
    }

    function setCookie(name, data, maxAge) {
        const encodedData = encodeURIComponent(JSON.stringify(data));
        // Encode for safety
        document.cookie = `${name}=${encodedData}; max-age=${maxAge}; path=/; secure; samesite=strict`;
    }


    if (!customerId) {
        console.log("No customer ID error.");
        return;
    }

    if (!debugMode && !demoMode && !getCookie(SESSION_KEY) && sampleRate) {
        if (Math.random() > sampleRate) {
            console.log("Skipping this session.");
            return;
        }
    }

    if (debugMode) {
        console.log("Debug mode enabled")
        console.log(forceIds)
    }

    if (demoMode) {
        console.log("Demo mode enabled")
    }

    if (noTracking) {
        console.log("Not tracking sessions")
    }

    const botRegex = new RegExp(" daum[ /]| deusu/| yadirectfetcher|(?:^|[^g])news(?!sapphire)|" + "google(?!(app|/google| pixel))|bot|spider|crawl|http|lighthouse|screenshot", "i");

    const simpleBotRegex = /bot|spider|crawl|http|lighthouse|screenshot/i;
    let compiledRegex;

    function log(statement) {
        !debugMode || console.debug(statement)
    }

    function applyStyles(selector, style) {
        const styleElement = document.createElement("style");
        styleElement.innerHTML = `${selector} { ${style} }`;

        const head = document.getElementsByTagName("head")[0];
        if (head) {
            head.appendChild(styleElement);
        }
        return styleElement;
    }

    function removeStyle(style) {
        const head = document.getElementsByTagName("head")[0];
        try {
            head.removeChild(style);
        } catch {
        }
    }

    let hidingStyle = applyStyles('.dalton-no-flicker', 'opacity: 0;');

    // fallback function
    setTimeout(() => {
        removeStyle(hidingStyle);
    }, 1000);

    const observer = new MutationObserver(() => {


        const elements = document.querySelectorAll('h1, h2, h3 , h4, h5, h6, p, div, a');

        const filtered = Array.from(elements).filter(element => {
            if (element.tagName === "DIV" && element.childNodes.length === 0) {
                return false;
            }
            const isNavElement = element.closest('nav, .navbar, .navigation, .menu, .nav-menu, #main-menu');
            if (isNavElement) {
                return false;
            }
            const rect = element.getBoundingClientRect();
            const isAboveFold = rect.top < window.innerHeight;
            if (!isAboveFold) {
                return false;
            }
            // Check if all child nodes are either text or <br>, <a> elements
            return Array.from(element.childNodes).every(node => node.nodeType === Node.TEXT_NODE || (node.nodeType === Node.ELEMENT_NODE && (node.tagName === "BR" || node.tagName === "SPAN" || node.tagName === "A")));
        });

        for (let element of filtered) {
            element.classList.add("dalton-no-flicker");
        }
    });

    if (debugMode)
        console.log(`Starting observer after ${(new Date().getTime() / 1000 - startTime).toFixed(1)}s`)
    observer.observe(document.documentElement, {childList: true, subtree: true});


    function getBotRegex() {
        if (compiledRegex instanceof RegExp) return compiledRegex;
        try {
            compiledRegex = botRegex;
        } catch {
            compiledRegex = simpleBotRegex;
        }
        return compiledRegex;
    }

    function isBot(userAgent) {
        return !!userAgent && getBotRegex().test(userAgent);
    }

    if (window.Shopify && window.Shopify.designMode) {
        log("Skipping script for design mode");
        return
    }
    if (window.location.href.includes("slScreenshot=true")) {
        log("Skipping for screenshot");
        return
    }
    if (window.location.hostname.endsWith(".shopifypreview.com") || window.location.hostname.endsWith(".edgemesh.com")) {
        log("Skipping for preview mode");
        return
    }
    if (isBot(navigator.userAgent)) {
        log("skipping because ot detected.")
        return;
    }


    let deviceId = getCookie(DEVICE_KEY);
    if (!deviceId) {
        deviceId = crypto.randomUUID();
        //setCookie(DEVICE_KEY, deviceId, 100 * 24 * 60 * 60 * 1000)
    }


    const getSession = new Promise(resolve => {
        let session = getCookie(SESSION_KEY);
        if (session && !debugMode && !demoMode && !forceIds) {
            console.log("existing session")
            resolve(session);
        } else {
            fetch("https://track.getdalton.com/api/session", {
                method: "POST", body: JSON.stringify({customer_id: customerId, ids: forceIds})
            }).then(response => response.json())
                .then(r => {
                    if (slowDown)
                        setTimeout(() => resolve(r), 2000)
                    else resolve(r);
                }).catch(() => {
                console.error("Could not create new session.");
                resolve();
            });

        }
    });


    function changeElementTextByContent(selection, textToFind, newText) {
        // Find all elements in the document
        log(`Trying to replace ${textToFind} and -${newText}-`)

        if (typeof newText !== "string")
            return false

        let elements = [];
        if (selection) {
            log("Got nodelist to replace text.")
            for (const s of selection) {
                elements.push(...s.querySelectorAll('*'));
            }

        } else {
            elements = document.querySelectorAll('*');
        }
        for (const element of elements) {
            if (element.innerHTML.trim().toLowerCase() === textToFind.toLowerCase()) {
                element.innerHTML = newText;
                log(`Text changed in element: ${newText}`);
                return true; // Stop after the first match

            }
        }
        console.warn(`No element found with the text: "${textToFind}"`);
        return false;
    }

    function checkFlickerId(experiment) {
        try {
            return !!document.getElementById(experiment.bandit.content.flicker_id)
        } catch {
            return false;
        }
    }


    function handleTextBandit(experiment) {
        let selection = null
        if (experiment.bandit.content.query) {
            let search = document.querySelectorAll(experiment.bandit.content.query);
            log(`Matched ${search.length} element(s) with query ${experiment.bandit.content.query}`)
            if (search.length === 0)
                return false
            if (!experiment.bandit.content.source) {
                if (experiment.arm.text_content) {
                    log(`Doing full replace of ${experiment.arm.text_content}`)
                    if (experiment.bandit.content.all) {
                        for (let s of search) {
                            s.textContent = experiment.arm.text_content
                        }
                    } else search[0].textContent = experiment.arm.text_content
                    return true
                }
                if (experiment.arm.inner_html) {
                    log(`Doing full replace of ${experiment.arm.inner_html}`)
                    if (experiment.bandit.content.all) {
                        for (let s of search) {
                            s.innerHTML = experiment.arm.inner_html
                        }
                    } else search[0].innerHTML = experiment.arm.inner_html
                    return true
                }
            }
            selection = search
        }
        let matched = false;
        let result = false;

        for (let index = 0; index < experiment.bandit.content.source.length; ++index) {
            result = changeElementTextByContent(selection, experiment.bandit.content.source[index].k, experiment.arm.subs[index].v);
            matched = matched || result;
        }
        return matched;

    }

    function handleSectionBandit(experiment) {
        log(experiment.arm.sections)
        for (let sectionLocation of experiment.arm.sections) {
            log(`Finding section with ${sectionLocation.query}`)
            let section = document.querySelector(sectionLocation.query);
            if (section) {
                let parent = section.parentElement
                if (parent.children[sectionLocation.index]) {
                    // Move the section to the correct position in the main element
                    parent.insertBefore(section, parent.children[sectionLocation.index]);
                } else {
                    // If the target index is out of bounds, append the section at the end
                    parent.appendChild(section);
                }
                return true
            }
        }
        return false;

    }

    function handleHideBandit(experiment) {
        let found = []
        for (let hideLocation of experiment.arm.sections) {
            log(`Finding element with ${hideLocation.query}`)
            let element = document.querySelector(hideLocation.query);
            if (element) {
                element.remove();
                found.push(true)
            }
        }
        return (found.length > 0 && found.every(x => x))
    }


    function handleBlockingExperiment(experiment) {
        try {
            const observer = new MutationObserver(() => {
                if (checkFlickerId(experiment)) {
                    handleExperiment(experiment);
                    observer.disconnect();
                }

            });
            observer.observe(document.documentElement, {childList: true, subtree: true});
        } catch (err) {
            console.log(err)
        }
    }

    function handleExperiment(experiment) {
        if (!experiment.arm) {
            log("baseline experiment.")
            return true
        }

        try {
            if (experiment.bandit.type === 'SECTIONS') {
                return handleSectionBandit(experiment)
            }
            if (experiment.bandit.type === 'TEXT') {
                return handleTextBandit(experiment)
            }
            if (experiment.bandit.type === 'HIDE') {
                return handleHideBandit(experiment)
            }
        } catch (err) {
            console.error(err)
            return false;
        }
    }

    function runExperiments(experiments) {
        experiments = experiments.map(v => ({...v, done: !v.arm}))
        window.dalton.baseline = experiments.filter(e => !e.done).length === 0
        if (window.dalton.baseline)
            return

        // Track the last time we processed experiments to throttle execution
        let lastProcessTime = 0;
        const THROTTLE_TIME = 100; // ms

        const observer = new MutationObserver(() => {
            const now = Date.now();
            if (now - lastProcessTime < THROTTLE_TIME) {
                return
            }
            lastProcessTime = now
            if (debugMode)
                console.log(`Trying to run experiment after ${(new Date().getTime() / 1000 - startTime).toFixed(2)}s`)
            experiments = experiments.filter(exp => !exp.done).map(v => ({...v, done: handleExperiment(v)}))
            window.dalton.failed_bandits = experiments.filter(exp => !exp.done).map(exp => exp.bandit.id)
            log(window.dalton)
            if (experiments.filter(exp => !exp.done).length === 0) {
                window.dalton.failed_bandits = null
                log("Done with all experiments.")
                observer.disconnect();
            }
        });
        observer.observe(document.documentElement, {childList: true, subtree: true});
        experiments = experiments.filter(exp => !exp.done).map(v => ({...v, done: handleExperiment(v)}))
    }

    window.dalton = {
        deviceId: deviceId, customerId: customerId,
        debugMode: debugMode, failed_bandits: null, consent: false
    }

    function checkConsent() {
        try {
            if (!window.dataLayer) return true;
            let consentMode = false
            for (let ev of window.dataLayer) {
                if (ev[0] === 'consent' && ev[2].analytics_storage === 'granted') return true
                if (ev[0] === 'consent') consentMode = true
            }
            return !consentMode
        } catch {
            console.log("something went wrong when getting consent.")
            return true;
        }

    }

    function setCookies() {
        if (checkConsent()) {
            if (!getCookie(SESSION_KEY) && window.dalton.session) {
                console.log("setting session cookie.")
                setCookie(SESSION_KEY, window.dalton.session, SESSION_TIMEOUT);
            }
            if (!getCookie(DEVICE_KEY) && window.dalton.deviceId) {
                console.log("setting device cookie.")
                setCookie(DEVICE_KEY, window.dalton.deviceId, 100 * 24 * 60 * 60 * 1000);
            }
            clearInterval(checker)
        }
    }

    let checker = setInterval(setCookies, 500);

    if (debugMode)
        console.log(`Starting session promise after ${(new Date().getTime() / 1000 - startTime).toFixed(2)}s`)

    // Synchronize data fetch and DOM readiness
    Promise.all([getSession])
        .then(([session]) => {
            if (debugMode)
                console.log(`Got session after ${(new Date().getTime() / 1000 - startTime).toFixed(2)}s`)
            if (!session || (!session.customer.enabled && !debugMode)) {
                log(session);
                log("Stopping AB test script.");
                removeStyle(hidingStyle)
                return
            }
            if (!session.ids || session.ids.length === 0) {
                console.log("Will not start tracking here.")
                removeStyle(hidingStyle)
                return
            }

            window.dalton.data = session.ids
            window.dalton.sessionId = session.session_id
            window.dalton.session = session
            window.dalton.baseline = false
            log(session);
            sessionId = session.session_id
            session.data = session.data.filter(exp => exp.bandit.page === window.location.pathname)
            log(`Filtered ${session.data.length} experiment(s) for page ${window.location.pathname}`)
            window.dalton.isRelevantPage = session.data.length > 0

            if (debugMode)
                console.log(`Start running experiments after ${(new Date().getTime() / 1000 - startTime).toFixed(2)}s`)
            if (session.data) {
                runExperiments(session.data)
            }
            // send custom event to GA if possible
            if (window.dataLayer) {
                log("GA array exists:")
                log(window.dataLayer)
                window.dataLayer.push(['event', 'dalton', {'baseline': window.dalton.baseline}])
            }

            if (debugMode)
                console.log(`Removing style after ${(new Date().getTime() / 1000 - startTime).toFixed(2)}s`)
            removeStyle(hidingStyle)
            if (!demoMode && !noTracking)
                startTracking();
        })
        .catch(err => {
            console.error('Error in script execution:', err);
            removeStyle(hidingStyle)
        });

})();

function startTracking() {
    const customerId = window.dalton.customerId
    const sessionId = window.dalton.sessionId
    const debugMode = window.dalton.debugMode

    const EVENTS = [];
    const API_ENDPOINT = "https://track.getdalton.com/api/track";

    // Helper function to track events
    function trackEvent(eventType, eventData) {
        const event = {
            session_id: sessionId, event_type: eventType, event_data: eventData,
            timestamp: new Date().toISOString(),
            relevant_page: window.dalton.isRelevantPage
        }
        if (debugMode)
            console.log(event)
        if (EVENTS.length > 0 && EVENTS[-1] === event) {
            console.log("Detected duplicate event.")
            return
        }
        EVENTS.push(event);
    }

    function detectBrowserAndDevice(userAgent, sh, sw) {
        // Browser detection rules
        const browsers = [
            {name: "Chrome", regex: /Chrome|CriOS/},
            {name: "Safari", regex: /Safari/},
            {name: "Firefox", regex: /Firefox/},
            {name: "Edge", regex: /Edg/},
            {name: "Opera", regex: /Opera|OPR/},
            {name: "Samsung Internet", regex: /SamsungBrowser/},
            {name: "IE", regex: /MSIE|Trident/}
        ];

        // Detect browser
        let browserName = browsers.find(({regex}) => regex.test(userAgent))?.name || null;

        // Device type breakpoints
        const breakpoints = {
            mobile: {maxWidth: 767},
            tablet: {minWidth: 768, maxWidth: 1024},
            desktop: {minWidth: 1025}
        };

        // Parse screen width
        const screenWidth = parseInt(sw, 10);
        const screenHeight = parseInt(sh, 10);
        // Determine device type
        let deviceType = null;
        if (!isNaN(screenWidth) && !isNaN(screenHeight)) {
            if (screenWidth <= breakpoints.mobile.maxWidth) {
                deviceType = "mobile";
            } else if (screenWidth >= breakpoints.tablet.minWidth && screenWidth <= breakpoints.tablet.maxWidth) {
                deviceType = "tablet";
            } else if (screenWidth >= breakpoints.desktop.minWidth) {
                deviceType = "desktop";
            }
        }

        return {
            browser: browserName,
            deviceType
        };
    }

    const {
        browser,
        deviceType
    } = detectBrowserAndDevice(window.navigator.userAgent, window.screen.height, window.screen.width)

    const sendData = async () => {
        if (window.sessionEvents_) {
            window.sessionEvents_.forEach(event => {
                EVENTS.push({
                    session_id: sessionId, event_type: event[0], event_data: {}, timestamp: event[1].toISOString(),
                });
            })
            window.sessionEvents_ = [];
        }

        if (EVENTS.length > 0) {
            try {

                // Send batch data to the backend
                const analytics = JSON.stringify({
                    events: EVENTS,
                    session_id: sessionId,
                    customer_id: customerId,
                    device_type: deviceType,
                    device_id: window.dalton.deviceId,
                    failures: window.dalton.failed_bandits,
                    ids: window.dalton.data,
                    session_info: {
                        referrer: document.referrer || "direct",
                        viewportWidth: window.innerWidth,
                        viewportHeight: window.innerHeight,
                        sh: window.screen.height,
                        sw: window.screen.width,
                        language: window.navigator?.language,
                        agent: window.navigator?.userAgent,
                    }

                });
                if (debugMode) {
                    console.log("sending events")
                    console.log(analytics)
                    EVENTS.length = 0;
                    return
                }
                navigator.sendBeacon(API_ENDPOINT, analytics);

                // Clear the events array after successful transmission
                EVENTS.length = 0;
            } catch (err) {
                console.error("Error sending tracking data:", err);
                EVENTS.length = 0;
            }
        }
    }


    let scrollTimeout = null;


    function addToCartListener() {
        // Select all forms with the action '/cart/add'
        const forms = document.querySelectorAll('form[action="/cart/add"]');
        const pageUrl = window.location.pathname;

        // Loop through each form
        forms.forEach(function (form) {
            // Select the Add to Cart button within the form
            const addToCartButton = form.querySelector('button[type="submit"], input[type="submit"]');

            if (addToCartButton) {
                addToCartButton.addEventListener("click", function () {
                    // Prevent the default action just for our custom tracking (but don't stop form submission)
                    //event.preventDefault();

                    // Capture form data (product ID and quantity)
                    let formData = new FormData(form);
                    let productId = formData.get("id");
                    let quantity = formData.get("quantity") || 1;


                    // Attempt to find price (Modify selector based on your theme)
                    let priceElement = document.querySelector('.price, [data-price]');
                    let price = priceElement ? parseInt(priceElement.innerText.replace(/[^0-9]/g, '')) : -1;


                    trackEvent("add_to_cart", {product_id: productId, quantity, price, page_url: pageUrl});

                    // Manually submit the form (so the cart behavior is not interrupted)
                    //form.submit();
                });
            }
        });

    }

    function clickListener(e) {
        const {pageX: x, pageY: y, target} = e;

        const clickableElement = target.closest("button, a") || target;
        const targetDetails = target.tagName.toLowerCase();
        const pageUrl = window.location.pathname;
        // Element-specific details
        const elementDetails = {
            tagName: target.tagName.toLowerCase(), // Tag name of clicked element
            id: target.id || null, // ID if available
            classList: [...target.classList].join(" ") || null, // Classes
            textContent: target.textContent.trim().slice(0, 50) || null, // Text content (limited to 50 chars)
            href: clickableElement.tagName.toLowerCase() === "a" ? clickableElement.href : null, // Include href for links
        };

        trackEvent("click", {x, y, target: targetDetails, page_url: pageUrl, details: elementDetails});
        // Send the tracking data immediately
        sendData().then();
    }


    function scrollListener() {
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }
        scrollTimeout = setTimeout(() => {
            const scrollDepth = window.scrollY;
            const pageHeight = document.documentElement.scrollHeight;
            const scrollPercentage = (scrollDepth / pageHeight) * 100;
            const pageUrl = window.location.pathname;

            trackEvent("scroll", {scroll_depth: scrollDepth, scroll_percentage: scrollPercentage, page_url: pageUrl});
        }, 200); // Trigger event logging 200ms after user stops scrolling

    }

    console.log(document.ab_listeners)

    if (document._IS_TRACKING) {


    } else {
        document._IS_TRACKING = true
        document.ab_listeners = []
        if (window.dalton.isRelevantPage) {
            document.addEventListener("click", clickListener);
            document.addEventListener("scroll", scrollListener);
            document.ab_listeners.push(scrollListener)
            document.ab_listeners.push(clickListener)
        }

    }

    setInterval(sendData, 5000); // Send data every 4 seconds

    trackEvent("page_view", {page_url: window.location.pathname});
    sendData().then()

    document.ab_listeners = []

    document.addEventListener("DOMContentLoaded", addToCartListener);
    if (document.readyState === "complete") {
        addToCartListener(null)
    }

    window.removeEventListener("beforeunload", sendData);
    window.addEventListener("beforeunload", sendData);
    window.removeEventListener("visibilitychange ", sendData);
    window.addEventListener("visibilitychange ", sendData);
    document.ab_listeners.push(sendData)


}
