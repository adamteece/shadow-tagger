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

export interface URLRuleState {
    includeDomain: boolean;
    domainWildcard: boolean;
    pathSegments: URLSegment[];
    queryParams: URLQueryParam[];
    includeHash: boolean;
    hashValue: string;
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

        // Path segments: split by / then handle ; matrix params
        const rawPathSegments = url.pathname.split('/').filter(Boolean);
        const pathSegments: URLSegment[] = [];

        rawPathSegments.forEach(rawSeg => {
            if (rawSeg.includes(';')) {
                const parts = rawSeg.split(';');
                // The first part is the actual path segment name
                pathSegments.push(this.createSegment(parts[0]));
                // The rest are matrix parameters like key=value
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

        return {
            includeDomain: false,
            domainWildcard: true,
            pathSegments,
            queryParams,
            includeHash: false,
            hashValue: url.hash.replace(/^#/, '')
        };
    }

    private createSegment(val: string): URLSegment {
        // If it's a matrix param like key=val, check only the val for dynamic
        const dynamicCheckVal = val.includes('=') ? val.split('=')[1] : val;
        const isDynamic = this.isDynamic(dynamicCheckVal);

        return {
            value: isDynamic ? (val.includes('=') ? `${val.split('=')[0]}=*` : '*') : val,
            originalValue: val,
            type: isDynamic ? 'wildcard' : 'literal'
        };
    }

    private isDynamic(val: string): boolean {
        return Object.values(this.patterns).some(pattern => pattern.test(val));
    }

    public generateRule(state: URLRuleState): string {
        const { includeDomain, domainWildcard, pathSegments, queryParams, includeHash, hashValue } = state;

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
                // Append matrix param to the last path segment added
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

        if (queryParams.length > 0) {
            const activeParams = queryParams
                .filter(p => p.type !== 'exclude')
                .map(p => `${p.key}=${p.type === 'wildcard' ? '*' : p.value}`);

            if (activeParams.length > 0) {
                rule += `?${activeParams.join('&')}`;
            }
        }

        if (includeHash && hashValue) {
            rule += `#${hashValue}`;
        }

        return rule;
    }
}
