/* Sticky-nav color swap: transparent/light-text over the hero -> translucent
 * paper/blur bar with dark text once scrolled past ~0.72x viewport height.
 * A real `scroll` listener (rAF-throttled), replacing the design prototype's
 * setInterval polling hack.
 */
(function () {
  'use strict';

  var nav = document.querySelector('[data-navbar]');
  if (!nav) return;

  var primary = nav.querySelectorAll('[data-nav]');
  var dim = nav.querySelectorAll('[data-nav-dim]');
  var solid = false;
  var ticking = false;

  function apply(isSolid) {
    if (isSolid === solid) return;
    solid = isSolid;
    nav.classList.toggle('is-solid', solid);
    primary.forEach(function (a) { a.style.color = solid ? '#1C2438' : '#EAF0F8'; });
    dim.forEach(function (a) { a.style.color = solid ? '#5D6880' : 'rgba(234,240,248,.72)'; });
  }

  function check() {
    ticking = false;
    var vh = window.innerHeight || 800;
    var y = window.scrollY || window.pageYOffset || 0;
    apply(y > vh * 0.72);
  }

  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(check);
  }, { passive: true });

  check();
})();
