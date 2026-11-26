/**
 * Header du site Le Guérandais : Header.js, SubHeader.js et ToggleContent.js
 * du thème, réunis.
 *
 * - burger : data-toggle-open sur le conteneur, scroll de la page bloqué ;
 * - SubHeader : réapparaît quand on remonte la page, passé 300px.
 */
export class Header {
  constructor(container) {
    this.container = container;
    this.button = container.querySelector('[data-toggle-element="button"]');
    this.button?.addEventListener('click', () => this.toggle());
  }

  toggle(open = !this.container.hasAttribute('data-toggle-open')) {
    this.container.toggleAttribute('data-toggle-open', open);
    this.button?.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  }
}

export class SubHeader extends Header {
  constructor(container) {
    super(container);
    this.ticking = false;
    this.latestKnownScrollY = 0;
    this.updateHeader = this.updateHeader.bind(this);

    window.addEventListener('scroll', () => {
      if (this.ticking) return;
      this.ticking = true;
      requestAnimationFrame(this.updateHeader);
    }, { passive: true });

    // Un lien cliqué dans le menu ouvert le referme.
    container.querySelectorAll('.SubHeader-menu a').forEach((link) => {
      link.addEventListener('click', () => this.toggle(false));
    });
  }

  updateHeader() {
    const visible = window.scrollY < this.latestKnownScrollY && this.latestKnownScrollY >= 300;
    document.body.classList.toggle('is-subheader-visible', visible);
    // Masqué, le SubHeader sort aussi de l'ordre de tabulation.
    this.container.inert = !visible;
    this.container.setAttribute('aria-hidden', String(!visible));
    this.latestKnownScrollY = window.scrollY;
    this.ticking = false;
  }
}

/**
 * Température à Guérande. Le site interroge une route Drupal
 * (/ajax/html/guerandais_temperature) ; la démo étant statique, elle passe
 * par Open-Meteo, sans clé. En cas d'échec, la ligne est masquée.
 */
export async function loadTemperature(element) {
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=47.33&longitude=-2.43&current=temperature_2m';
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(response.statusText);
    const data = await response.json();
    const target = element.querySelector('.js-temperature');
    target.textContent = String(Math.round(data.current.temperature_2m));
  } catch {
    element.hidden = true;
  }
}
