/* Scroll-reveal: fade + rise elements tagged [data-rv] into place on first
 * entry, staggered by their [data-delay] (ms). Standard IntersectionObserver
 * — replaces the design prototype's setInterval polling hack (see README
 * "Read this before copying the JS").
 */
(function () {
  'use strict';

  var allEls = Array.prototype.slice.call(document.querySelectorAll('[data-rv]'));
  if (!allEls.length) return;

  if (!('IntersectionObserver' in window)) {
    // No IO support: just show everything, no reveal animation.
    allEls.forEach(function (el) {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    return;
  }

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return; // content is already visible in markup; skip the fade/rise entirely

  function prepare(el) {
    el.style.opacity = '0';
    el.style.transform = 'translateY(28px)';
    el.style.transition = 'opacity .9s cubic-bezier(.2,.7,.2,1), transform .9s cubic-bezier(.2,.7,.2,1)';
  }

  function reveal(el) {
    var delay = el.getAttribute('data-delay');
    if (delay) el.style.transitionDelay = delay + 'ms';
    el.style.opacity = '1';
    el.style.transform = 'none';
  }

  var observerOpts = { rootMargin: '0px 0px -8% 0px', threshold: 0 };

  // The App Store screenshot rail scrolls horizontally (overflow-x: auto),
  // which clips IntersectionObserver's intersection rect on that axis too —
  // a screenshot scrolled off to the right would never register as
  // "visible" and would stay hidden forever, even after the user has
  // scrolled well past the section vertically. Reveal that row as a group,
  // triggered by the rail container itself (not horizontally clipped by
  // anything), instead of observing each screenshot individually.
  var rail = document.querySelector('.screens-rail');
  var railEls = rail ? allEls.filter(function (el) { return rail.contains(el); }) : [];
  var singleEls = allEls.filter(function (el) { return railEls.indexOf(el) === -1; });

  singleEls.forEach(prepare);
  var singleIo = new IntersectionObserver(function (entries, observer) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      reveal(entry.target);
      observer.unobserve(entry.target);
    });
  }, observerOpts);
  singleEls.forEach(function (el) { singleIo.observe(el); });

  if (rail && railEls.length) {
    railEls.forEach(prepare);
    var railIo = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        railEls.forEach(reveal);
        observer.disconnect();
      });
    }, observerOpts);
    railIo.observe(rail);
  }
})();
