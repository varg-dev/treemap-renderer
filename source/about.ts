
/**
 * Provided via the vite define and git-rev-sync.
 */
declare let __GIT_COMMIT__: string;
declare let __GIT_BRANCH__: string;
declare let __LIB_VERSION__: string;

/**
 * `haeley.template.branch()` provides the git revision branch at build-time.
 */
export const branch = (): undefined | string =>
    typeof __GIT_BRANCH__ !== 'undefined' ? `${__GIT_BRANCH__}` : undefined;

/**
 * `haeley.template.commit()` provides the git revision commit at build-time.
 */
export const commit = (): undefined | string =>
    typeof __GIT_COMMIT__ !== 'undefined' ? `${__GIT_COMMIT__}` : undefined;

/**
 * `haeley.template.version()` provides the npm package version at build-time.
 */
export const version = (): undefined | string =>
    typeof __LIB_VERSION__ !== 'undefined' ? `${__LIB_VERSION__}` : undefined;
