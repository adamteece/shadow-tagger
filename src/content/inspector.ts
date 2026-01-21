import { SelectorEngine, SelectorOptions, ElementNode } from '../services/selector-engine';
import { Highlighter } from './highlighter';

export interface InspectorAnalysis {
    selector: string;
    breadcrumbs: string[];
    isInsideShadow: boolean;
    path: ElementNode[];
}

export class Inspector {
    private engine: SelectorEngine;
    private highlighter: Highlighter;
    private isActive: boolean = false;
    private onElementSelected?: (analysis: InspectorAnalysis) => void;

    constructor() {
        this.engine = new SelectorEngine();
        this.highlighter = new Highlighter();
        this.setupListeners();
    }

    public setOptions(options: Partial<SelectorOptions>) {
        this.engine.setOptions(options);
    }

    public getEngine(): SelectorEngine {
        return this.engine;
    }


    public activate(callback: (analysis: InspectorAnalysis) => void) {
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
                const path = this.engine.buildPath(target);
                if (this.onElementSelected) {
                    this.onElementSelected({
                        ...analysis,
                        path
                    });
                }
            }
        }, { capture: true });
    }
}

