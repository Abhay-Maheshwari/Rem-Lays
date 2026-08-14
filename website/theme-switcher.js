// RemLays Obsidian Pro Theme Initializer
(function() {
  document.documentElement.setAttribute('data-theme', 'obsidian');

  // Custom Cursor Initialization
  document.addEventListener("DOMContentLoaded", function() {
    if (window.matchMedia("(pointer: coarse)").matches) return; // Skip for touch devices

    const cursor = document.createElement("div");
    cursor.className = "custom-cursor";
    
    document.body.appendChild(cursor);

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let cursorX = mouseX;
    let cursorY = mouseY;
    let isVisible = false;

    document.addEventListener("mousemove", function(e) {
      if (!isVisible) {
        isVisible = true;
      }
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    document.addEventListener("mouseleave", function() {
      cursor.style.opacity = 0;
    });

    document.addEventListener("mouseenter", function() {
      cursor.style.opacity = 1;
    });

    function animateCursor() {
      // Smooth follow for the single circle
      cursorX += (mouseX - cursorX) * 0.4;
      cursorY += (mouseY - cursorY) * 0.4;
      
      cursor.style.transform = `translate(${cursorX}px, ${cursorY}px) translate(-50%, -50%)`;
      requestAnimationFrame(animateCursor);
    }
    animateCursor();

    // Hover state for interactive elements
    function addHoverListeners() {
      const interactables = document.querySelectorAll("a, button, input, textarea, select, .cta, .nav-cta, .dl-btn, .card");
      interactables.forEach(el => {
        // Remove existing listener if any, then add to avoid duplicates if called multiple times
        el.removeEventListener("mouseenter", handleEnter);
        el.removeEventListener("mouseleave", handleLeave);
        el.addEventListener("mouseenter", handleEnter);
        el.addEventListener("mouseleave", handleLeave);
      });
    }

    function handleEnter() {
      cursor.classList.add("hover");
    }

    function handleLeave() {
      cursor.classList.remove("hover");
    }

    addHoverListeners();

    // In case DOM changes, re-run hover listeners (optional but good for dynamic content)
    const observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;
      mutations.forEach(mutation => {
        if (mutation.addedNodes.length > 0) shouldUpdate = true;
      });
      if (shouldUpdate) addHoverListeners();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
