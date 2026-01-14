export interface SelectorResult {
    selector: string;
    score: number;
    isShadow: boolean;
    depth: number;
}

export interface SelectorOptions {
    prioritizeDataTestId: boolean;
    prioritizeAriaLabel: boolean;
    prioritizeIds: boolean;
}

export class SelectorEngine {
    public options: SelectorOptions;

    constructor(options: SelectorOptions = {
        prioritizeDataTestId: true,
        prioritizeAriaLabel: true,
        prioritizeIds: true
    }) {
        this.options = options;
    }

    public setOptions(options: Partial<SelectorOptions>) {
        this.options = { ...this.options, ...options };
    }

    /**
   * Generates a Pendo-compliant selector and metadata for an element.
   */
    public getAnalysis(element: HTMLElement) {
        const path = this.getComposedPath(element);
        const selectorParts: string[] = [];
        const breadcrumbs: string[] = [];
        let isInsideShadow = false;

        for (let i = 0; i < path.length; i++) {
            const node = path[i];

            if (node instanceof ShadowRoot) {
                isInsideShadow = true;
                const host = path[i + 1] as HTMLElement;
                const hostSelector = this.getBestBaseSelector(host);
                selectorParts.unshift(hostSelector + '::shadow');
                breadcrumbs.unshift('::shadow');
                i++;
            } else if (node instanceof HTMLElement) {
                const selector = this.getBestBaseSelector(node);
                if (i === 0) {
                    selectorParts.push(selector);
                }
                breadcrumbs.unshift(node.tagName.toLowerCase() + (node.id ? `#${node.id}` : ''));
            }
        }

        return {
            selector: selectorParts.join(' '),
            breadcrumbs: breadcrumbs.slice(-5), // Keep last 5 for UI space
            isInsideShadow
        };
    }

    public getSelector(element: HTMLElement): string {
        return this.getAnalysis(element).selector;
    }

    private getComposedPath(element: HTMLElement): Node[] {
        // If the browser supports composedPath on events, we can trigger a dummy event
        // but better to just traverse manually or use a helper if available.
        // For now, let's use a manual traversal to handle shadow roots correctly.
        const path: Node[] = [];
        let current: Node | null = element;

        while (current) {
            path.push(current);
            if (current instanceof HTMLElement && current.assignedSlot) {
                current = current.assignedSlot;
            } else if (current instanceof ShadowRoot) {
                current = current.host;
            } else {
                current = current.parentNode;
            }
        }

        return path;
    }

    private getBestBaseSelector(element: HTMLElement): string {
        // 1. Data attributes (data-pendo-id, data-testid)
        if (this.options.prioritizeDataTestId) {
            const testId = element.getAttribute('data-testid') || element.getAttribute('data-pendo-id');
            if (testId) return `[data-testid="${testId}"]`;
        }

        // 2. IDs (check for dynamic patterns)
        if (this.options.prioritizeIds && element.id && !this.isDynamicId(element.id)) {
            return `#${element.id}`;
        }

        // 3. ARIA labels
        if (this.options.prioritizeAriaLabel) {
            const ariaLabel = element.getAttribute('aria-label');
            if (ariaLabel) return `[aria-label="${ariaLabel}"]`;
        }

        // 4. Tag + Class (filter dynamic classes)
        const tagName = element.tagName.toLowerCase();
        const className = Array.from(element.classList)
            .filter(c => !this.isDynamicClass(c))
            .join('.');

        if (className) return `${tagName}.${className}`;

        // 5. Fallback to Tag
        return tagName;
    }

    private isDynamicId(id: string): boolean {
        // Basic heuristic for dynamic IDs (numbers, long hex, etc.)
        return /\d{5,}/.test(id) || /^[0-9a-f]{8,}/i.test(id);
    }

    private isDynamicClass(cls: string): boolean {
        // Common CSS-in-JS patterns (sc-, css-, etc.)
        return /^sc-/.test(cls) || /^css-/.test(cls) || cls.length > 20;
    }
}
