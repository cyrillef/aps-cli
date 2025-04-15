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

import moment from 'moment';

import { SdkManager } from '@aps_sdk/autodesk-sdkmanager'
import { Scopes, TwoLeggedToken } from '@aps_sdk/authentication';

import AppSettings from '@/app/app-settings';
import { sdkManager } from '@/aps';
import TLogger, { errorMessage } from '@/utils/logger';
import SimplifiedScopes from '@/oauth/scopes';
import OauthClientUtils from '@/oauth/utils';
import { Jwt, JwtPayload } from 'jsonwebtoken';

export class TwoLeggedClient extends OauthClientUtils {

	public static readonly StorageKey: string = '2legged';

	protected constructor(sdkmanager: SdkManager) {
		super(sdkmanager, TwoLeggedClient.StorageKey);
	}

	public static async build(expiredOk: boolean = false): Promise<TwoLeggedClient> {
		const twoLeggedClient: TwoLeggedClient = new TwoLeggedClient(sdkManager);
		(sdkManager as any)._authClient = twoLeggedClient; // Sajith: authClient is a placeholder for the future, but readonly
		twoLeggedClient.token = await twoLeggedClient.loadCredentials();
		if (twoLeggedClient.expired && twoLeggedClient.token?.access_token) {
			//if (twoLeggedClient.autoRefresh)
			//throw new Error('Requires a valid token! (token has expired)');
			const previous: Jwt | null = await twoLeggedClient.decode(twoLeggedClient.token?.access_token);
			await twoLeggedClient.generateToken((previous?.payload as JwtPayload).scope || [Scopes.ViewablesRead], true);
			if (!twoLeggedClient.token || twoLeggedClient.expired)
				throw new Error('Requires a valid token! (token has expired)');
		}
		if (twoLeggedClient.expired && !expiredOk)
			throw new Error('Requires a valid token! (token has expired)');
		return (twoLeggedClient);
	}

	public static async execute(cmd: string, scopes: string, options: any): Promise<void> {
		!options.debug && (sdkManager.logger = new TLogger());
		const twoLeggedClient: TwoLeggedClient = await TwoLeggedClient.build(true);
		if (/*!scopes &&*/ !['token', 'decode', 'verify'].includes(cmd)) {
			scopes = cmd || scopes;
			cmd = 'token';
		}

		cmd === 'token' && await twoLeggedClient.getToken(scopes, options);
		cmd === 'decode' && await twoLeggedClient.decode(options);
		cmd === 'verify' && await twoLeggedClient.verify(options);
	}

	//#region Generate 2 legged token
	// Sajith - I add to create my own auto-refresh logic
	protected async generateToken(scopes: Scopes[] = [Scopes.DataRead], autoRefresh: boolean = true): Promise<TwoLeggedToken> {
		const token: TwoLeggedToken = await this.authenticationClient.getTwoLeggedToken(
			AppSettings.apsClientId,
			AppSettings.apsClientSecret,
			scopes
		) || {};
		token.expires_in = token.expires_in || 0;
		(token as any).expires_at = token.expires_in + moment().unix();
		//console.log('expires_at: ' + moment(1000 * (token as any).expires_at).format('HH:mm:ss'));
		this.token = token;
		await this.saveCredentials(token);

		const _this: TwoLeggedClient = this;
		this.autoRefresh && clearTimeout(this.autoRefresh);
		this.autoRefresh = null;
		autoRefresh
			&& token.expires_in
			&& (this.autoRefresh = setTimeout((): any => _this.generateToken(scopes), 60000)); //(token.expires_in - 300) * 1000));
		return (this.token);
	}

	protected async getToken(scopes: string, options: any): Promise<TwoLeggedToken | null> {
		try {
			let _scopes: Scopes[] = SimplifiedScopes.string2Scopes(scopes);
			const credentials: TwoLeggedToken = await this.generateToken(_scopes, false);
			options.json && console.log(this.toString());
			options.text && console.log(`Token will expire at: ${moment(1000 * (credentials as any).expires_at).format('dddd, MMMM Do YYYY, h:mm:ss a')}`);
			return (credentials);
		} catch (error: any) {
			this.token = null;
			return (errorMessage(error, options));
		}
	}
	//#endregion

}

export default TwoLeggedClient;
