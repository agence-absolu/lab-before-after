import './styles/main.scss';
import BeforeAfterHeader from './scripts/BeforeAfterHeader.js';
import Header from './scripts/Header.js';

document.querySelectorAll('[data-before-after="container"]').forEach((container) => {
  new BeforeAfterHeader(container);
});

document.querySelectorAll('[data-toggle-element="container"]').forEach((container) => {
  new Header(container);
});
