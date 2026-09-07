(function () {
  "use strict";

  var videos = Array.from(document.querySelectorAll("video[data-autoplay-loop]"));
  if (!videos.length) return;

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var connection = navigator.connection;
  var states = videos.map(function (video) {
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.loop = true;

    var state = {
      video: video,
      visible: false,
      visibilityKnown: false,
      userPaused: false,
      blocked: false,
      pending: false,
      pendingInterrupted: false,
      automaticPauses: 0
    };

    video.addEventListener("pause", function () {
      if (state.automaticPauses > 0) {
        state.automaticPauses -= 1;
      } else {
        state.userPaused = true;
      }
    });
    video.addEventListener("play", function () {
      state.userPaused = false;
      state.blocked = false;
      if (document.hidden || (state.visibilityKnown && !state.visible)) {
        pauseAutomatically(state);
      }
    });
    return state;
  });

  function automaticPlaybackAllowed() {
    return !reducedMotion.matches && !(connection && connection.saveData);
  }

  function pauseAutomatically(state) {
    if (!state.video.paused) {
      if (state.pending) state.pendingInterrupted = true;
      state.automaticPauses += 1;
      state.video.pause();
    }
  }

  function sync(state) {
    if (!state.visible || document.hidden) {
      pauseAutomatically(state);
      return;
    }
    // Reduced-motion/data-saving visitors can still use the native Play control.
    if (!automaticPlaybackAllowed() || state.userPaused || state.blocked ||
        state.pending || !state.video.paused) return;

    state.pending = true;
    state.pendingInterrupted = false;
    var attempt;
    try {
      attempt = state.video.play();
    } catch (error) {
      state.pending = false;
      state.blocked = true;
      return;
    }
    Promise.resolve(attempt).then(function () {
      state.pending = false;
      // A play request can finish after scrolling away or changing preferences.
      if (!state.visible || document.hidden || !automaticPlaybackAllowed()) {
        pauseAutomatically(state);
      }
    }, function (error) {
      state.pending = false;
      // Scrolling away may abort a pending play; it is not an autoplay denial.
      if (!error || error.name !== "AbortError") state.blocked = true;
      // Retry only requests we interrupted ourselves. This handles rapid
      // leave/re-entry without repeatedly retrying an unrelated AbortError.
      if (error && error.name === "AbortError" && state.pendingInterrupted) {
        sync(state);
      }
      // Native controls and the poster remain available if autoplay is blocked.
    });
  }

  function syncAll() {
    states.forEach(sync);
  }

  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var state = states.find(function (item) { return item.video === entry.target; });
        if (!state) return;
        state.visibilityKnown = true;
        state.visible = entry.isIntersecting && entry.intersectionRatio >= 0.25;
        sync(state);
      });
    }, { threshold: [0, 0.25] });
    states.forEach(function (state) { observer.observe(state.video); });
  }
  // Without IntersectionObserver, retain manual playback rather than loading
  // every offscreen clip automatically.

  document.addEventListener("visibilitychange", syncAll);

  function preferencesChanged() {
    if (!automaticPlaybackAllowed()) states.forEach(pauseAutomatically);
    syncAll();
  }
  if (reducedMotion.addEventListener) {
    reducedMotion.addEventListener("change", preferencesChanged);
  } else if (reducedMotion.addListener) {
    reducedMotion.addListener(preferencesChanged);
  }
  if (connection && connection.addEventListener) {
    connection.addEventListener("change", preferencesChanged);
  }
})();
