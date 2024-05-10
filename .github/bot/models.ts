export interface Registry {
    [name: string]: Plugin;
}

export interface Plugin {
    name: string;
    authors: string[];
    description: string;
    isDeprecated: boolean;
    categories: string[];
    keywords: string[];
    urls: {
        repository?: string;
        readme?: string;
    };
    release: {
        stable: Release;
        prerelease?: Release;
    };
}

export interface Release {
    signature: string;
    version: string;
    url: string;
}

export interface Problem {
    path: string;
    position?: number | undefined;
    body: string;
    line?: number | undefined;
    side?: string | undefined;
    start_line?: number | undefined;
    start_side?: string | undefined;
}
