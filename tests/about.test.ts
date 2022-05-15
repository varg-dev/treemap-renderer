
/* spellchecker: disable */

import { expect } from 'chai';

import * as git from 'git-rev-sync';

import { version, branch, commit } from '../source/about';

/* tslint:disable:no-unused-expression */


describe('About validation', () => {

    it('should report library version', () => {

        expect((global as any).__LIB_VERSION__).to.be.undefined;
        expect(version()).to.be.undefined;

        (global as any).__LIB_VERSION__ = process.env.npm_package_version;
        expect(version()).to.be.not.undefined;

        const re = /^[0-9]+\.[0-9]+\.[0-9]+$/;
        const match = version()!.match(re);
        expect(match).to.have.lengthOf(1);
        expect(match![0]).to.equal(version());
    });

    it('should report git branch/tag name', () => {

        expect((global as any).__GIT_BRANCH__).to.be.undefined;
        expect(branch()).to.be.undefined;

        const package_branch = git.branch();
        (global as any).__GIT_BRANCH__ = package_branch;
        expect(branch()).to.be.a.string;
        expect(branch()).to.equal(package_branch);
    });

    it('should report git commit name', () => {

        expect((global as any).__GIT_COMMIT__).to.be.undefined;
        expect(commit()).to.be.undefined;

        const package_commit = git.short();
        (global as any).__GIT_COMMIT__ = package_commit;
        expect(commit()).to.be.a.string;
        expect(commit()).to.equal(package_commit);
    });

});
