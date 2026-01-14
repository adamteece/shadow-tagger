export interface SelectorResult {
    selector: string;
    score: number;
    isShadow: boolean;
    depth: number;
}

export interface SelectorOptions {
    priorityAttributes: string[];
    prioritizeIds: boolean;
}

export class SelectorEngine {
    public options: SelectorOptions;

    constructor(options: SelectorOptions = {
        priorityAttributes: ['data-testid', 'data-pendo-id', 'aria-label'],
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
        // 1. Custom priority attributes
        for (const attr of this.options.priorityAttributes) {
            const val = element.getAttribute(attr);
            if (val) return `[${attr}="${val}"]`;
        }

        // 2. IDs (check for dynamic patterns)
        if (this.options.prioritizeIds && element.id && !this.isDynamicId(element.id)) {
            return `#${element.id}`;
        }

        // 3. Tag + Class (filter dynamic classes)
        const tagName = element.tagName.toLowerCase();
        const className = Array.from(element.classList)
            .filter(c => !this.isDynamicClass(c))
            .join('.');

        if (className) return `${tagName}.${className}`;

        // 4. Fallback to Tag
        return tagName;
    }

    private isDynamicId(id: string): boolean {
        return /\d{5,}/.test(id) || /^[0-9a-f]{8,}/i.test(id);
    }

    private isDynamicClass(cls: string): boolean {
        return /^sc-/.test(cls) || /^css-/.test(cls) || cls.length > 20;
    }
}
