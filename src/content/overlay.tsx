import React from 'react';
import { createRoot } from 'react-dom/client';
import { OverlayContainer } from './OverlayContainer';
import { Inspector } from './inspector';

const initOverlay = () => {
    const host = document.createElement('div');
    host.id = 'shadow-tagger-host';
    document.body.appendChild(host);

    const shadowRoot = host.attachShadow({ mode: 'open' });
    const container = document.createElement('div');
    shadowRoot.appendChild(container);

    // Inject styles into shadow DOM
    // (In a more advanced setup, we'd use a CSS processor or emotion)
    const style = document.createElement('style');
    style.textContent = `
    :host {
      all: initial;
    }
  `;
    shadowRoot.appendChild(style);

    const inspector = new Inspector();
    const root = createRoot(container);
    root.render(<OverlayContainer inspector={inspector} />);
};

initOverlay();
