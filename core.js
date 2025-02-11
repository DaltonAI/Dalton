(function () {
    // If navigating to the same page, don't re-run
    let currentPage = window.location.pathname;
    if (document._ABCurrentPage === currentPage) return;
    document._ABCurrentPage = currentPage;

    console.log("Initializing AB test script...")
    let SESSION_KEY = 'quicklift_session';
    const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

    const queryString = window.location.search;
    const urlParams2 = new URLSearchParams(queryString);
    let debugMode = parseInt(urlParams2.get('debug_mode') || 0);
    let demoMode = parseInt(urlParams2.get('demo_mode') || 0);
    let noTracking = parseInt(urlParams2.get('disable_tracking')) || 0;
    const scriptUrl = document.currentScript.src;
    const urlParams = new URLSearchParams(new URL(scriptUrl).search);
    const customerId = parseInt(urlParams.get("customer_id"));
    SESSION_KEY += `_${urlParams.get("customer_id")}`;
    let sessionId = null;

    if (!customerId) {
        console.log("No customer ID error.");
        Promise.all([waitForDom])
            .then(() => {
                document.body.style.opacity = '1';
            })
        return;
    }

    if (debugMode) {
        console.log("Debug mode enabled")
    }

    if (demoMode) {
        console.log("Demo mode enabled")
    }

    if (noTracking) {
        console.log("Not tracking sessions")
    }

    setTimeout(() => {
        // applyStyles('.hide-maniac', 'opacity: 1 !important;');
    }, 1000);

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
        console.log("Removing style.")
        const head = document.getElementsByTagName("head")[0];
        head.removeChild(style);
    }

    let hidingStyle = applyStyles('.hide-maniac', 'opacity: 0;');
    const observer = new MutationObserver(() => {


        const elements = document.querySelectorAll('h1, h2, h3 , h4, p, div');

        const filtered = Array.from(elements).filter(heading => {
            // Check if all child nodes are either text or <br> elements
            return Array.from(heading.childNodes).every(node => node.nodeType === Node.TEXT_NODE || (node.nodeType === Node.ELEMENT_NODE && (node.tagName === "BR" || node.tagName === "SPAN")));
        });

        for (let element of filtered) {
            element.classList.add("hide-maniac");
        }
    });
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

    // Wait for the DOM to be minimally ready
    const waitForDom = new Promise(resolve => {
        if (document.body) {
            resolve(); // Body is already available
        } else {
            const observer = new MutationObserver(() => {
                if (document.body) {
                    observer.disconnect();
                    resolve(); // Body is now available
                }
            });
            observer.observe(document.documentElement, {childList: true});
        }
    });


    const getSession = new Promise(resolve => {
        let session = getCookie(SESSION_KEY);
        if (session && !debugMode && !demoMode) {
            console.log("existing session")
            resolve(session);
        } else {
            fetch("https://quicklift-tracker.vercel.app/api/session", {
                method: "POST", body: JSON.stringify({customer_id: customerId})
            }).then(response => response.json())
                .then(r => {
                    setCookie(SESSION_KEY, r, SESSION_TIMEOUT);
                    resolve(r);
                }).catch(() => {
                console.log("Could not create new session.");
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
            console.log(element.innerHTML.trim().toLowerCase())
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
                log(`Doing full replace of ${experiment.arm.text_content}`)
                search[0].textContent = experiment.arm.text_content
                return true
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
            log(`Finding section with ${sectionLocation.key}-> ${sectionLocation.value}`)
            let sections = document.querySelectorAll('section');
            for (let section of sections) {
                log(section.getAttribute(sectionLocation.key))
                if (section.getAttribute(sectionLocation.key).includes(sectionLocation.value)) {
                    let parent = section.parentElement
                    if (parent.children[sectionLocation.index]) {
                        // Move the section to the correct position in the main element
                        parent.insertBefore(section, main.children[sectionLocation.index]);
                    } else {
                        // If the target index is out of bounds, append the section at the end
                        parent.appendChild(section);
                    }
                    return true
                }

            }
        }
        return false;

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
        } catch (err) {
            console.log(err)
            return false;
        }
    }

    function runExperiments(experiments) {
        experiments = experiments.map(v => ({...v, done: false}))
        const observer = new MutationObserver(() => {
            experiments = experiments.filter(exp => !exp.done).map(v => ({...v, done: handleExperiment(v)}))
            console.log(experiments.filter(exp => !exp.done).length)
            if (experiments.filter(exp => !exp.done).length === 0) {
                log("Done with all experiments.")
                observer.disconnect();
            }
        });
        observer.observe(document.documentElement, {childList: true, subtree: true});
        experiments = experiments.filter(exp => !exp.done).map(v => ({...v, done: handleExperiment(v)}))
    }

    // Synchronize data fetch and DOM readiness
    Promise.all([getSession])
        .then(([session]) => {
            if (!session || (!session.customer.enabled && !debugMode)) {
                log(session);
                log("Stopping AB test script.");
                removeStyle(hidingStyle)
                return
            }

            log(session);
            sessionId = session.session_id
            session.data = session.data.filter(exp => exp.bandit.page === window.location.pathname)
            log(`Filtered ${session.data.length} experiment(s) for page ${window.location.pathname}`)
            if (session.data) {
                runExperiments(session.data)
            }
            removeStyle(hidingStyle)
            if (!demoMode && !noTracking)
                startTracking(customerId, sessionId, session.ids, debugMode);
            console.log("Done.")
        })
        .catch(err => {
            console.error('Error in script execution:', err);
            removeStyle(hidingStyle)
        });

})();

function startTracking(customerId, sessionId, Ids, debugMode) {
    const EVENTS = []; // Local array to store events
    const API_ENDPOINT = "https://quicklift-tracker.vercel.app/api/track"; // Replace with your API endpoint

    // Helper function to track events
    function trackEvent(eventType, eventData) {
        console.log(eventType, eventData);
        const event = {
            session_id: sessionId, event_type: eventType, event_data: eventData, timestamp: new Date().toISOString(),
        }
        if (EVENTS.length > 0 && EVENTS[-1] === event) {
            console.log("Detected duplicate event.")
        }
        EVENTS.push(event);
    }

    const sendData = async () => {
        if (debugMode) {
            return
        }
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
                    ids: Ids,
                    agent: window.navigator.userAgent,
                });
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

        const wixAddToCart = document.querySelectorAll('button[data-hook*="add-to-cart"], button[data-hook*="buy-now-button"]');
        if (wixAddToCart) {
            console.log("Detected WIX add to cart buttons")
            wixAddToCart.forEach(addToCartButton => addToCartButton.addEventListener("click", function () {
                trackEvent("add_to_cart", {page_url: pageUrl});
            }))
        }
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
        document.addEventListener("click", clickListener);
        document.addEventListener("scroll", scrollListener);
        document.ab_listeners.push(scrollListener)
        document.ab_listeners.push(clickListener)
    }

    setInterval(sendData, 3000); // Send data every 3 seconds

    trackEvent("page_view", {page_url: window.location.pathname});

    document.ab_listeners = []

    document.addEventListener("DOMContentLoaded", addToCartListener);
    if (document.readyState === "complete") {
        addToCartListener(null)
    }

    window.removeEventListener("beforeunload", sendData);
    window.addEventListener("beforeunload", sendData);
    document.ab_listeners.push(sendData)


}
