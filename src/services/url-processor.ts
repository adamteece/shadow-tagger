export interface URLRule {
    normalizedUrl: string;
    segments: URLSegment[];
}

export interface URLSegment {
    value: string;
    originalValue: string;
    isDynamic: boolean;
    type: 'literal' | 'wildcard' | 'ignore-after';
}

export class URLProcessor {
    private patterns = {
        uuid: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
        objectId: /[0-9a-f]{24}/i,
        numeric: /^\d+$/,
        base64: /[A-Za-z0-9_-]{20,}/
    };

    public analyzeUrl(urlStr: string): URLRule {
        const url = new URL(urlStr);
        const pathSegments = url.pathname.split('/').filter(Boolean);

        const segments: URLSegment[] = pathSegments.map(seg => {
            const isDynamic = this.isDynamic(seg);
            return {
                value: isDynamic ? '*' : seg,
                originalValue: seg,
                isDynamic,
                type: isDynamic ? 'wildcard' : 'literal'
            };
        });

        return {
            normalizedUrl: this.generateRule(segments, url.searchParams),
            segments
        };
    }

    private isDynamic(segment: string): boolean {
        return Object.values(this.patterns).some(pattern => pattern.test(segment));
    }

    public generateRule(segments: URLSegment[], searchParams: URLSearchParams): string {
        let path = segments.map(s => {
            if (s.type === 'wildcard') return '*';
            if (s.type === 'ignore-after') return '**';
            return s.value;
        }).join('/');

        // Handle ignore-after
        const ignoreIndex = segments.findIndex(s => s.type === 'ignore-after');
        if (ignoreIndex !== -1) {
            path = segments.slice(0, ignoreIndex).map(s => s.type === 'wildcard' ? '*' : s.value).join('/') + '/**';
        }

        let rule = `//*/${path}`;

        // Simple query param handling for now
        if (searchParams.size > 0) {
            const params: string[] = [];
            searchParams.forEach((value, key) => {
                params.push(`${key}=*`);
            });
            rule += `?${params.join('&')}`;
        }

        return rule;
    }
}
