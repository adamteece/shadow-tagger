import { SelectorEngine, SelectorOptions } from '../services/selector-engine';
import { Highlighter } from './highlighter';

export class Inspector {
    private engine: SelectorEngine;
    private highlighter: Highlighter;
    private isActive: boolean = false;
    private onElementSelected?: (analysis: { selector: string, breadcrumbs: string[], isInsideShadow: boolean }) => void;

    constructor() {
        this.engine = new SelectorEngine();
        this.highlighter = new Highlighter();
        this.setupListeners();
    }

    public setOptions(options: Partial<SelectorOptions>) {
        this.engine.setOptions(options);
    }

    public activate(callback: (analysis: { selector: string, breadcrumbs: string[], isInsideShadow: boolean }) => void) {
        this.isActive = true;
        this.onElementSelected = callback;
        document.body.style.cursor = 'crosshair';
    }

    public deactivate() {
        this.isActive = false;
        this.highlighter.hide();
        document.body.style.cursor = 'default';
    }

    private setupListeners() {
        window.addEventListener('mouseover', (e) => {
            if (!this.isActive) return;

            const target = e.composedPath()[0] as HTMLElement;
            if (target && target instanceof HTMLElement) {
                this.highlighter.highlight(target);
            }
        }, { capture: true });

        window.addEventListener('click', (e) => {
            if (!this.isActive) return;

            e.preventDefault();
            e.stopPropagation();

            const target = e.composedPath()[0] as HTMLElement;
            if (target && target instanceof HTMLElement) {
                const analysis = this.engine.getAnalysis(target);
                if (this.onElementSelected) {
                    this.onElementSelected(analysis);
                }
            }
        }, { capture: true });
    }
}
