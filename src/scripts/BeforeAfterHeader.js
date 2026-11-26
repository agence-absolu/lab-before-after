/**
 * Bandeau avant / après.
 *
 * Reprend la mécanique de l'entête d'accueil des Arcs :
 * - parallaxe au scroll : l'image descend (+60px) pendant que le texte
 *   remonte (-140px) sur la hauteur du bandeau ;
 * - bascule entre deux états via un toggle.
 *
 * La bascule, ici, n'est pas un rechargement AJAX : l'image « après » se
 * révèle en cercle depuis le bouton cliqué (clip-path), et l'année défile
 * de 1988 à 2028.
 */
const IMAGE_COURSE = 60;
const TEXT_COURSE = -140;
const YEAR_DURATION = 1200;

export default class BeforeAfterHeader {
  constructor(container) {
    this.container = container;
    this.image = container.querySelector('[data-before-after="image"]');
    this.text = container.querySelector('[data-before-after="text"]');
    this.year = container.querySelector('[data-before-after="year"]');
    this.caption = container.querySelector('[data-before-after="caption"]');
    this.buttons = Array.from(container.querySelectorAll('[data-before-after="button"]'));
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    this.ticking = false;
    this.isVisible = false;
    this.yearFrame = null;

    this.onScroll = this.onScroll.bind(this);
    this.updateParallax = this.updateParallax.bind(this);

    this.buttons.forEach((button) => {
      button.addEventListener('click', () => this.setState(button));
    });

    this.initParallax();
  }

  /* ---------- Bascule avant / après ---------- */

  setState(button) {
    const state = button.dataset.state;
    if (state === this.container.dataset.state) return;

    this.setRevealOrigin(button);
    this.buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    this.container.dataset.state = state;

    if (this.caption) this.caption.textContent = button.dataset.caption ?? '';
    this.animateYear(Number(button.dataset.year));
  }

  /**
   * Le cercle de révélation part du centre du bouton cliqué, exprimé dans
   * le repère du plan image (qui est décalé par la parallaxe).
   */
  setRevealOrigin(button) {
    const planeRect = this.image.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const x = buttonRect.left + buttonRect.width / 2 - planeRect.left;
    const y = buttonRect.top + buttonRect.height / 2 - planeRect.top;
    this.container.style.setProperty('--reveal-x', `${Math.round(x)}px`);
    this.container.style.setProperty('--reveal-y', `${Math.round(y)}px`);
  }

  animateYear(target) {
    if (!this.year || Number.isNaN(target)) return;
    cancelAnimationFrame(this.yearFrame);

    const from = Number(this.year.textContent) || target;
    if (this.reducedMotion.matches || from === target) {
      this.year.textContent = String(target);
      return;
    }

    const start = performance.now();
    const step = (now) => {
      const progress = Math.min(1, (now - start) / YEAR_DURATION);
      // easeInOutCubic : le défilement accélère puis se pose sur l'année.
      const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
      this.year.textContent = String(Math.round(from + (target - from) * eased));
      if (progress < 1) this.yearFrame = requestAnimationFrame(step);
    };
    this.yearFrame = requestAnimationFrame(step);
  }

  /* ---------- Parallaxe (repris des Arcs) ---------- */

  initParallax() {
    if (this.reducedMotion.matches) return;

    this.io = new IntersectionObserver((entries) => {
      this.isVisible = entries[0]?.isIntersecting ?? false;
      this.updateParallax();
    });
    this.io.observe(this.container);
    window.addEventListener('scroll', this.onScroll, { passive: true });
    this.updateParallax();
  }

  onScroll() {
    if (this.ticking || !this.isVisible) return;
    this.ticking = true;
    requestAnimationFrame(this.updateParallax);
  }

  updateParallax() {
    const rect = this.container.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, -rect.top) / rect.height);
    this.image?.style.setProperty('--img-y', `${Math.round(ratio * IMAGE_COURSE)}px`);
    this.text?.style.setProperty('--text-y', `${Math.round(ratio * TEXT_COURSE)}px`);
    this.ticking = false;
  }
}
