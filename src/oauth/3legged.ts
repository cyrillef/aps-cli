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

import _http, { IncomingMessage as Request, ServerResponse as Response, Server } from 'http';
import _url, { UrlWithParsedQuery } from 'url';
import _path from 'path';
import moment from 'moment';
// import open, { apps } from 'open';

let open: any;
(async () => {
	open = await import('open');
	// Your code using `open` goes here
})();

import { SdkManager } from '@aps_sdk/autodesk-sdkmanager'
import { ResponseType, Scopes, ThreeLeggedToken } from '@aps_sdk/authentication';

import AppSettings from '@/app/app-settings';
import { sdkManager } from '@/aps';
import TLogger, { errorMessage } from '@/utils/logger';
import SimplifiedScopes from '@/oauth/scopes';
import OauthClientUtils from '@/oauth/utils';
import { ChildProcess } from 'child_process';
import { Jwt, JwtPayload } from 'jsonwebtoken';

// class Request extends typeof IncomingMessage = typeof IncomingMessage,
// class Response extends typeof ServerResponse = typeof ServerResponse,

export class ThreeLeggedClient extends OauthClientUtils {

	public static readonly StorageKey: string = '3legged';

	protected constructor(sdkmanager: SdkManager) {
		super(sdkmanager, ThreeLeggedClient.StorageKey);
	}

	public static async build(expiredOk: boolean = false): Promise<ThreeLeggedClient> {
		const threeLeggedClient: ThreeLeggedClient = new ThreeLeggedClient(sdkManager);
		(sdkManager as any)._authClient = threeLeggedClient; // Sajith: authClient is a placeholder for the future, but readonly
		threeLeggedClient.token = await threeLeggedClient.loadCredentials();
		if (threeLeggedClient.expired && threeLeggedClient.token?.access_token) {
			//if (threeLeggedClient.autoRefresh)
			//throw new Error('Requires a valid token! (token has expired)');
			const previous: Jwt | null = await threeLeggedClient.decode(threeLeggedClient.token?.access_token);
			await threeLeggedClient.refreshTokenInternal((previous?.payload as JwtPayload).scope || [Scopes.ViewablesRead]);
			if (!threeLeggedClient.token || threeLeggedClient.expired)
				throw new Error('Requires a valid token! (token has expired)');
		}
		if (threeLeggedClient.expired && !expiredOk)
			throw new Error('Requires a valid token! (token has expired)');
		return (threeLeggedClient);
	}

	public static async execute(cmd: string, scopes: string, options: any): Promise<void> {
		!options.debug && (sdkManager.logger = new TLogger());
		const threeLeggedClient: ThreeLeggedClient = await ThreeLeggedClient.build(true);
		if (!scopes && !['token', 'refresh', 'decode', 'verify',].includes(cmd)) {
			scopes = cmd;
			cmd = 'token';
		}
		cmd === 'token' && await threeLeggedClient.getToken(scopes, options);
		cmd === 'refresh' && await threeLeggedClient.refreshToken(scopes, options);
		cmd === 'decode' && await threeLeggedClient.decode(options);
		cmd === 'verify' && await threeLeggedClient.verify(options);
	}

	//#region Generate 3 legged token
	public generateUrl(scopes: Scopes[] = [Scopes.DataRead], state?: string): string {
		return (this.authenticationClient.authorize(
			AppSettings.apsClientId,
			ResponseType.Code,
			AppSettings.apsCallback,
			scopes,
			{ state, }
		));
	}

	protected async generateTokenFromCode(code: string, scopes: Scopes[] = [Scopes.DataRead], autoRefresh: boolean = true): Promise<ThreeLeggedToken> {
		const token: ThreeLeggedToken = await this.authenticationClient.getThreeLeggedToken(
			AppSettings.apsClientId,
			code,
			AppSettings.apsCallback,
			{ clientSecret: AppSettings.apsClientSecret, }
		) || {};
		token.expires_in = token.expires_in || 0;
		(token as any).expires_at = token.expires_in + moment().unix();
		//console.log('expires_at: ' + moment(1000 * (token as any).expires_at).format('HH:mm:ss'));
		this.token = token;
		await this.saveCredentials(token);
		// const _this: ThreeLeggedClient = this;
		// this.autoRefresh && clearTimeout(this.autoRefresh);
		// this.autoRefresh = null;
		// autoRefresh
		// 	&& token.expires_in
		// 	&& (this.autoRefresh = setTimeout((): any => _this.generateTokenFromRefreshToken(scopes), 60000)); //(token.expires_in - 300) * 1000));
		return (this.token as ThreeLeggedToken);
	}

	protected async getToken(scopes: string, options: any): Promise<ThreeLeggedToken | null> {
		try {
			let _scopes: Scopes[] = SimplifiedScopes.string2Scopes(scopes);
			const url: string = this.generateUrl(_scopes, 'localhost');
			const child: ChildProcess = await open(url); // { wait: false, }
			const code: string = await this.waitCodeAfterSignIn(AppSettings.apsCallback, true);
			const credentials: ThreeLeggedToken = await this.generateTokenFromCode(code, _scopes, false);
			options.json && console.log(this.toString());
			options.text && console.log(`Token will expire at: ${moment(1000 * (credentials as any).expires_at).format('dddd, MMMM Do YYYY, h:mm:ss a')}`);
			return (credentials);
		} catch (error: any) {
			this.token = null;
			return (errorMessage(error, options));
		}
	}

	protected async waitCodeAfterSignIn(callback: string, auto: boolean): Promise<string> {
		return (new Promise((resolve: (value: string) => void, reject: (reason?: any) => void): void => {
			if (!auto) {
				console.log('Wait for the browser to return a code and run this script again with the code as parameter...');
				// setTimeout(() => process.exit(), 1000);
				return (resolve(''));
			}

			const q: UrlWithParsedQuery = _url.parse(callback, true);
			const server: Server<typeof Request, typeof Response> = _http.createServer(
				(request: Request, response: Response) => {
					if (request.method === 'GET' && request.url?.indexOf(q.path || '') !== -1) {
						const query: UrlWithParsedQuery = _url.parse(request.url || '', true);
						response.end('You can close this window!');
						setTimeout((): void => { server.close(); }, 500);
						resolve(query.query.code as string || '');
					}
				});
			server.listen(AppSettings.PORT);
		}));
	}
	//#endregion

	//#region Refresh 3 legged token
	protected async refreshTokenInternal(scopes: Scopes[]): Promise<ThreeLeggedToken | null> {
		try {
			const credentials: ThreeLeggedToken = await this.loadCredentials();
			const token: ThreeLeggedToken = await this.authenticationClient.refreshToken(
				AppSettings.apsClientId,
				credentials.refresh_token,
				{ clientSecret: AppSettings.apsClientSecret, scopes, }
			);
			token.expires_in = token.expires_in || 0;
			(token as any).expires_at = token.expires_in + moment().unix();
			this.token = token;
			await this.saveCredentials(token);
			return (token);
		} catch (error: any) {
			this.token = null;
			return (null);
		}
	}

	protected async refreshToken(scopes: string, options: any): Promise<ThreeLeggedToken | null> {
		try {
			let _scopes: Scopes[] = [];
			if (!scopes) {
				const decoded: any = await this.decode({}, true);
				_scopes = decoded.payload?.scope;
			}
			if (!_scopes || !_scopes.length)
				_scopes = SimplifiedScopes.string2Scopes(scopes);

			const credentials: ThreeLeggedToken | null = await this.refreshTokenInternal(_scopes);

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

export default ThreeLeggedClient;
