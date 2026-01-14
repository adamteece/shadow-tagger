export type SegmentType = 'literal' | 'wildcard' | 'ignore-after';

export interface URLSegment {
    value: string;
    originalValue: string;
    type: SegmentType;
    isMatrix?: boolean;
}

export interface URLQueryParam {
    key: string;
    value: string;
    type: 'exact' | 'wildcard' | 'exclude';
}

export interface URLHashComponent {
    key: string;
    value: string;
    type: 'exact' | 'wildcard' | 'exclude';
    isBase?: boolean;
}

export interface URLRuleState {
    includeDomain: boolean;
    domainWildcard: boolean;
    pathSegments: URLSegment[];
    queryParams: URLQueryParam[];
    hashComponents: URLHashComponent[];
}

export class URLProcessor {
    private patterns = {
        uuid: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
        objectId: /[0-9a-f]{24}/i,
        numeric: /^\d+$/,
        base64: /[A-Za-z0-9_-]{20,}/
    };

    public analyzeUrl(urlStr: string): URLRuleState {
        const url = new URL(urlStr);

        // Path segments
        const rawPathSegments = url.pathname.split('/').filter(Boolean);
        const pathSegments: URLSegment[] = [];

        rawPathSegments.forEach(rawSeg => {
            if (rawSeg.includes(';')) {
                const parts = rawSeg.split(';');
                pathSegments.push(this.createSegment(parts[0]));
                for (let i = 1; i < parts.length; i++) {
                    const matrixSeg = this.createSegment(parts[i]);
                    matrixSeg.isMatrix = true;
                    pathSegments.push(matrixSeg);
                }
            } else {
                pathSegments.push(this.createSegment(rawSeg));
            }
        });

        // Query parameters
        const queryParams: URLQueryParam[] = [];
        url.searchParams.forEach((value, key) => {
            queryParams.push({
                key,
                value,
                type: 'wildcard'
            });
        });

        // Hash components (Boomi-style: #base;key1=val1;key2=val2)
        const hashComponents: URLHashComponent[] = [];
        const fullHash = url.hash.replace(/^#/, '');
        if (fullHash) {
            const parts = fullHash.split(';');
            // Base part
            hashComponents.push({
                key: parts[0],
                value: '',
                type: 'exact',
                isBase: true
            });
            // Parameters
            for (let i = 1; i < parts.length; i++) {
                const segment = parts[i];
                if (segment.includes('=')) {
                    const [key, ...valParts] = segment.split('=');
                    const value = valParts.join('=');
                    hashComponents.push({
                        key,
                        value,
                        type: this.isDynamic(value) ? 'wildcard' : 'exact'
                    });
                } else {
                    hashComponents.push({
                        key: segment,
                        value: '',
                        type: 'exact'
                    });
                }
            }
        }

        return {
            includeDomain: false,
            domainWildcard: true,
            pathSegments,
            queryParams,
            hashComponents
        };
    }

    private createSegment(val: string): URLSegment {
        const dynamicCheckVal = val.includes('=') ? val.split('=')[1] : val;
        const isDynamic = this.isDynamic(dynamicCheckVal);

        return {
            value: isDynamic ? (val.includes('=') ? `${val.split('=')[0]}=*` : '*') : val,
            originalValue: val,
            type: isDynamic ? 'wildcard' : 'literal'
        };
    }

    private isDynamic(val: string): boolean {
        if (!val) return false;
        return Object.values(this.patterns).some(pattern => pattern.test(val));
    }

    public generateRule(state: URLRuleState): string {
        const { includeDomain, domainWildcard, pathSegments, queryParams, hashComponents } = state;

        let domainStr = '//*/';
        if (includeDomain) {
            domainStr = domainWildcard ? `//*/` : `//${window.location.hostname}/`;
        }

        let rule = domainStr;
        const activeSegments = [];

        for (let i = 0; i < pathSegments.length; i++) {
            const seg = pathSegments[i];
            if (seg.type === 'ignore-after') {
                activeSegments.push('**');
                break;
            }

            let val = seg.value;
            if (seg.type === 'wildcard') {
                val = seg.value.includes('=') ? `${seg.value.split('=')[0]}=*` : '*';
            }

            if (seg.isMatrix) {
                if (activeSegments.length > 0) {
                    activeSegments[activeSegments.length - 1] += `;${val}`;
                } else {
                    activeSegments.push(`;${val}`);
                }
            } else {
                activeSegments.push(val);
            }
        }

        rule += activeSegments.join('/');

        // Query parameters: ?key means match any value, ?key=value means match exact
        if (queryParams.length > 0) {
            const activeParams = queryParams
                .filter(p => p.type !== 'exclude')
                .map(p => {
                    if (p.type === 'wildcard') return p.key; // Official Pendo "any value" syntax
                    return `${p.key}=${p.value}`;
                });

            if (activeParams.length > 0) {
                rule += `?${activeParams.join('&')}`;
            }
        }

        // Hash components: normalize # to #! for path fragments
        const activeHash = hashComponents.filter(c => c.type !== 'exclude');
        if (activeHash.length > 0) {
            rule += '#!';
            const hashRuleParts = activeHash.map(c => {
                if (c.isBase) return c.key.replace(/^#!?/, '');
                if (c.type === 'wildcard') return c.key; // Match any value syntax
                return c.value ? `${c.key}=${c.value}` : c.key;
            });
            rule += hashRuleParts.filter(Boolean).join(';');
        }

        return rule;
    }
}
