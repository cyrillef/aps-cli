//
// Copyright (c) Autodesk, Inc. All rights reserved
//
// Permission to use, copy, modify, and distribute this software in
// object code form for any purpose and without fee is hereby granted,
// provided that the above copyright notice appears in all copies and
// that both that copyright notice and the limited warranty and
// restricted rights notice below appear in all supporting
// documentation.
//
// AUTODESK PROVIDES THIS PROGRAM 'AS IS' AND WITH ALL FAULTS.
// AUTODESK SPECIFICALLY DISCLAIMS ANY IMPLIED WARRANTY OF
// MERCHANTABILITY OR FITNESS FOR A PARTICULAR USE.  AUTODESK, INC.
// DOES NOT WARRANT THAT THE OPERATION OF THE PROGRAM WILL BE
// UNINTERRUPTED OR ERROR FREE.
//

import {Scopes } from '@aps_sdk/authentication';

export class SimplifiedScopes {

	public static all: { [index: string]: Scopes[] } = {
		v: [Scopes.ViewablesRead],
		r: [Scopes.DataRead, Scopes.DataSearch],
		w: [Scopes.DataWrite, Scopes.DataCreate],
		u: [Scopes.DataReadUrnOfResource],
		br: [Scopes.BucketRead],
		bw: [Scopes.BucketCreate, Scopes.BucketUpdate],
		bd: [Scopes.BucketDelete],
		e: [Scopes.CodeAll],
	};

	public static string2Scopes(scopes: string | undefined | null): Scopes[] {
		let _scopes: Scopes[] = scopes ? [] : SimplifiedScopes.all.r;
		if (scopes) {
			const keys: string[] = Object.keys(SimplifiedScopes.all).sort();
			for (let found = false; scopes.length; found = false) {
				for (let i = 0; i < keys.length; i++) {
					if (scopes.substring(0, keys[i].length) === keys[i]) {
						scopes = scopes.substring(keys[i].length);
						_scopes = [..._scopes, ...SimplifiedScopes.all[keys[i]]];
						found = true;
						break;
					}
				}
				if (!found)
					scopes = scopes.substring(1);
			}
		}
		return (_scopes);
	}

}

export default SimplifiedScopes;
