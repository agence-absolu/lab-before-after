import './styles/main.scss';
import BeforeAfterHeader from './scripts/BeforeAfterHeader.js';
import { Header, SubHeader, loadTemperature } from './scripts/Header.js';

document.querySelectorAll('[data-before-after="container"]').forEach((container) => {
  new BeforeAfterHeader(container);
});

document.querySelectorAll('[data-header-element="header_container"]').forEach((container) => {
  new Header(container);
});

document.querySelectorAll('[data-subheader-element="container"]').forEach((container) => {
  new SubHeader(container);
});

document.querySelectorAll('[data-temperature-element="element"]').forEach(loadTemperature);
