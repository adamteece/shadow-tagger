export class Highlighter {
    private overlay: HTMLElement;

    constructor() {
        this.overlay = document.createElement('div');
        this.setupOverlay();
    }

    private setupOverlay() {
        Object.assign(this.overlay.style, {
            position: 'fixed',
            pointerEvents: 'none',
            zIndex: '2147483647', // Max z-index
            border: '2px solid #00aaff',
            backgroundColor: 'rgba(0, 170, 255, 0.1)',
            transition: 'all 0.1s ease-out',
            display: 'none',
            boxSizing: 'border-box',
            borderRadius: '2px'
        });
        document.body.appendChild(this.overlay);
    }

    public highlight(element: HTMLElement) {
        const rect = element.getBoundingClientRect();

        Object.assign(this.overlay.style, {
            top: `${rect.top}px`,
            left: `${rect.left}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            display: 'block'
        });
    }

    public hide() {
        this.overlay.style.display = 'none';
    }
}
