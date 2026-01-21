export class Highlighter {
    private hoverOverlay: HTMLElement;
    private selectionOverlays: HTMLElement[] = [];

    constructor() {
        this.hoverOverlay = this.createOverlay('#00aaff', 'rgba(0, 170, 255, 0.1)');
    }

    private createOverlay(borderColor: string, bgColor: string): HTMLElement {
        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
            position: 'fixed',
            pointerEvents: 'none',
            zIndex: '2147483647',
            border: `2px solid ${borderColor}`,
            backgroundColor: bgColor,
            transition: 'all 0.1s ease-out',
            display: 'none',
            boxSizing: 'border-box',
            borderRadius: '2px'
        });
        document.body.appendChild(overlay);
        return overlay;
    }

    public highlight(element: HTMLElement) {
        this.positionOverlay(this.hoverOverlay, element);
    }

    public hide() {
        this.hoverOverlay.style.display = 'none';
    }

    public highlightSelection(elements: HTMLElement[]) {
        this.clearSelection();

        elements.forEach((el, i) => {
            let overlay = this.selectionOverlays[i];
            if (!overlay) {
                overlay = this.createOverlay('#4488ff', 'rgba(68, 136, 255, 0.2)');
                this.selectionOverlays.push(overlay);
            }
            this.positionOverlay(overlay, el);
        });
    }

    public clearSelection() {
        this.selectionOverlays.forEach(overlay => {
            overlay.style.display = 'none';
        });
    }

    private positionOverlay(overlay: HTMLElement, element: HTMLElement) {
        const rect = element.getBoundingClientRect();
        Object.assign(overlay.style, {
            top: `${rect.top}px`,
            left: `${rect.left}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            display: 'block'
        });
    }
}
