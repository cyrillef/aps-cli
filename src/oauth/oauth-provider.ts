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

import { IAuthenticationProvider } from '@aps_sdk/autodesk-sdkmanager';
import TwoLeggedClient from '@/oauth/2legged';
import ThreeLeggedClient from '@/oauth/3legged';
import OauthClientUtils from '@/oauth//utils';

export class AuthenticationProvider implements IAuthenticationProvider {

	protected constructor(private _credentials: TwoLeggedClient | ThreeLeggedClient) {
		if (!this._credentials || this._credentials.expired)
			throw new Error('Requires a valid token!');
	}

	public get credentials(): TwoLeggedClient | ThreeLeggedClient {
		return (this._credentials);
	}

	public static async build(storageKey?: string): Promise<AuthenticationProvider> {
		if (!storageKey)
			storageKey = await OauthClientUtils.getLastTokenType() || TwoLeggedClient.StorageKey;
		if (storageKey === TwoLeggedClient.StorageKey)
			return (new AuthenticationProvider(await TwoLeggedClient.build()));
		else if (storageKey === ThreeLeggedClient.StorageKey)
			return (new AuthenticationProvider(await ThreeLeggedClient.build()));

		throw new Error('Invalid authentication provider!');
	}

	public async getAccessToken(scopes?: string[]): Promise<string> {
		return (this._credentials.access_token);
	}

}

export default AuthenticationProvider;
