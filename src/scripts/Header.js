/**
 * Menu burger du header (sous 1130px), comme sur le site Le Guérandais :
 * l'attribut data-toggle-open sur le conteneur fait glisser le panneau.
 */
export default class Header {
  constructor(container) {
    this.container = container;
    this.button = container.querySelector('[data-toggle-element="button"]');
    this.button?.addEventListener('click', () => this.toggle());
  }

  toggle() {
    const open = !this.container.hasAttribute('data-toggle-open');
    this.container.toggleAttribute('data-toggle-open', open);
    this.button.setAttribute('aria-expanded', String(open));
    document.documentElement.classList.toggle('is-menu-open', open);
  }
}
