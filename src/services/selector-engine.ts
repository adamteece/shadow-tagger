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

export interface ElementIdentifier {
    type: 'tag' | 'id' | 'class' | 'data-attr' | 'aria-attr' | 'other-attr' | 'position';
    value: string;           // e.g., "button", "#submit", ".primary"
    selectorString: string;  // e.g., "button", "#submit", ".primary"
    enabled: boolean;        // User toggle state
    warning?: string;        // e.g., "Dynamic ID detected"
}

export interface ElementNode {
    element: HTMLElement;
    tagName: string;
    identifiers: ElementIdentifier[];
    isShadowBoundary: boolean;
    included: boolean;  // Whether this ancestor is included in selector
}

export interface SelectorBuilderState {
    path: ElementNode[];        // From target element up to root
    selectedNodeIndex: number;  // Which node is being configured
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

    public analyzeElement(element: HTMLElement): ElementIdentifier[] {
        const identifiers: ElementIdentifier[] = [];

        // Tag name (always included)
        identifiers.push({
            type: 'tag',
            value: element.tagName.toLowerCase(),
            selectorString: element.tagName.toLowerCase(),
            enabled: true
        });

        // ID
        if (element.id) {
            const isDynamic = this.isDynamicId(element.id);
            identifiers.push({
                type: 'id',
                value: element.id,
                selectorString: `#${element.id}`,
                enabled: !isDynamic,
                warning: isDynamic ? 'Dynamic ID detected' : undefined
            });
        }

        // Classes
        const stableClasses = Array.from(element.classList)
            .filter(c => !this.isDynamicClass(c));
        stableClasses.forEach(cls => {
            identifiers.push({
                type: 'class',
                value: cls,
                selectorString: `.${cls}`,
                enabled: false  // Not auto-selected
            });
        });

        // data-* attributes
        Array.from(element.attributes)
            .filter(attr => attr.name.startsWith('data-'))
            .forEach(attr => {
                identifiers.push({
                    type: 'data-attr',
                    value: `${attr.name}="${attr.value}"`,
                    selectorString: `[${attr.name}="${attr.value}"]`,
                    enabled: this.options.priorityAttributes.includes(attr.name)
                });
            });

        // aria-* attributes
        Array.from(element.attributes)
            .filter(attr => attr.name.startsWith('aria-'))
            .forEach(attr => {
                identifiers.push({
                    type: 'aria-attr',
                    value: `${attr.name}="${attr.value}"`,
                    selectorString: `[${attr.name}="${attr.value}"]`,
                    enabled: this.options.priorityAttributes.includes(attr.name)
                });
            });

        // Position (fallback)
        const parent = element.parentElement;
        if (parent) {
            const siblings = Array.from(parent.children).filter(
                el => el.tagName === element.tagName
            );
            if (siblings.length > 1) {
                const index = siblings.indexOf(element) + 1;
                identifiers.push({
                    type: 'position',
                    value: `:nth-of-type(${index})`,
                    selectorString: `:nth-of-type(${index})`,
                    enabled: false
                });
            }
        }

        return identifiers;
    }

    public buildPath(element: HTMLElement): ElementNode[] {
        const composedPath = this.getComposedPath(element);
        const elementNodes: ElementNode[] = [];

        for (let i = 0; i < composedPath.length; i++) {
            const node = composedPath[i];

            if (node instanceof HTMLElement) {
                if (node === document.documentElement) break;

                // A node is a shadow boundary if the previous node in the composed path (closer to target)
                // was a ShadowRoot.
                const isShadowBoundary = i > 0 && composedPath[i - 1] instanceof ShadowRoot;

                elementNodes.push({
                    element: node,
                    tagName: node.tagName.toLowerCase(),
                    identifiers: this.analyzeElement(node),
                    isShadowBoundary: isShadowBoundary,
                    included: elementNodes.length === 0
                });
            }
        }

        return elementNodes;
    }


    public generateSelectorFromPath(path: ElementNode[]): string {
        const parts: string[] = [];

        // 1. Identify all nodes that MUST be included in the selector
        // These are: explicitly included nodes OR any node that is a shadow boundary
        const mandatoryIndices: number[] = [];
        path.forEach((node, idx) => {
            if (node.included || node.isShadowBoundary) {
                mandatoryIndices.push(idx);
            }
        });

        // 2. Sort from root to target (reverse order of indices)
        const sortedIndices = mandatoryIndices.sort((a, b) => b - a);

        // 3. Generate selector parts for each node
        for (const idx of sortedIndices) {
            const node = path[idx];
            const enabledIds = node.identifiers.filter(id => id.enabled);
            let nodeSelector = '';

            const tag = enabledIds.find(id => id.type === 'tag');
            const id = enabledIds.find(id => id.type === 'id');
            const classes = enabledIds.filter(id => id.type === 'class');
            const attrs = enabledIds.filter(id =>
                ['data-attr', 'aria-attr', 'other-attr', 'position'].includes(id.type)
            );

            if (id) {
                nodeSelector = id.selectorString;
            } else if (tag) {
                nodeSelector = tag.selectorString;
                classes.forEach(c => nodeSelector += c.selectorString);
            } else if (classes.length > 0) {
                classes.forEach(c => nodeSelector += c.selectorString);
            } else if (attrs.length > 0) {
                // If nothing else, just use the first attribute
            }

            attrs.forEach(a => nodeSelector += a.selectorString);

            // If we still have no selector but need ::shadow, use tag name as fallback
            if (!nodeSelector && node.isShadowBoundary) {
                nodeSelector = node.tagName;
            }

            if (node.isShadowBoundary) {
                nodeSelector += '::shadow';
            }

            if (nodeSelector) {
                parts.push(nodeSelector);
            }
        }

        return parts.join(' ');
    }

    /**
     * Queries for elements matching a Pendo selector, which may contain ::shadow.
     */
    public queryPendoSelector(selector: string): HTMLElement[] {
        if (!selector) return [];

        // Split by ::shadow to handle multiple levels
        const segments = selector.split('::shadow').map(s => s.trim()).filter(Boolean);

        if (segments.length === 0) return [];

        let currentRoots: (Document | ShadowRoot)[] = [document];
        let matches: HTMLElement[] = [];

        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            const nextMatches: HTMLElement[] = [];

            for (const root of currentRoots) {
                try {
                    const found = root.querySelectorAll(segment);
                    found.forEach(el => nextMatches.push(el as HTMLElement));
                } catch (e) {
                    console.error(`Invalid selector segment: ${segment}`, e);
                }
            }

            if (i === segments.length - 1) {
                // Last segment, these are our final matches
                matches = nextMatches;
            } else {
                // Not the last segment, so each match must have a shadowRoot to continue
                currentRoots = nextMatches
                    .map(el => el.shadowRoot)
                    .filter((sr): sr is ShadowRoot => sr !== null);

                if (currentRoots.length === 0) break;
            }
        }

        return matches;
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

