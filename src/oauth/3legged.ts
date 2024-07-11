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
import jwt, { GetPublicKeyOrSecret, Jwt, JwtHeader, JwtPayload, SigningKeyCallback, VerifyErrors } from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
// import * as jwks from 'jwks-rsa';
import _http, { IncomingMessage as Request, ServerResponse as Response, Server } from 'http';
import _url, { UrlWithParsedQuery } from 'url';
import _path from 'path';

import { SdkManager } from '@aps_sdk/autodesk-sdkmanager'
import { AuthenticationClient, ResponseType, Scopes, ThreeLeggedToken } from '@aps_sdk/authentication';

import AppSettings from '@/app/app-settings';
import { sdkmanager } from '@/aps';
import DataMgr from '@/utils/dataMgr';
import TLogger, { errorMessage } from '@/utils/logger';
import SimplifiedScopes from '@/oauth/scopes';
import open from 'open';

// class Request extends typeof IncomingMessage = typeof IncomingMessage,
// class Response extends typeof ServerResponse = typeof ServerResponse,

export class ThreeLeggedClient {

	private authenticationClient: AuthenticationClient;
	private autoRefresh: NodeJS.Timeout | null = null;
	private _token: ThreeLeggedToken | null = null;
	private _scopes: Scopes[] = [Scopes.ViewablesRead];

	protected constructor(private sdkmanager: SdkManager) {
		this.authenticationClient = new AuthenticationClient(this.sdkmanager);
	}

	public get token(): ThreeLeggedToken | null { return (this._token); }
	protected set token(token: ThreeLeggedToken | null) { this._token = token; }

	public get expired(): boolean { return (!this.token || moment().isAfter(moment((this.token as any).expires_at * 1000))); }
	public get access_token(): string {
		if (this.token && moment().isBefore(moment((this.token as any).expires_at * 1000)))
			return (this.token.access_token as string);
		throw new Error('Requires a valid token!');
	}

	protected async generateTokenFromCode(code: string, scopes: Scopes[] = [Scopes.DataRead], autoRefresh: boolean = true): Promise<ThreeLeggedToken> {
		const token: ThreeLeggedToken | undefined = await this.authenticationClient.getThreeLeggedToken(
			AppSettings.apsClientId,
			code,
			AppSettings.apsCallback,
			{ clientSecret: AppSettings.apsClientSecret, }
		) || {};
		token.expires_in = token.expires_in || 0;
		(token as any).expires_at = token.expires_in + moment().unix();
		//console.log('expires_at: ' + moment(1000 * (token as any).expires_at).format('HH:mm:ss'));
		this.token = token;
		DataMgr.instance.store('3legged', token)

		// const _this: ThreeLeggedClient = this;
		// this.autoRefresh && clearTimeout(this.autoRefresh);
		// this.autoRefresh = null;
		// autoRefresh
		// 	&& token.expires_in
		// 	&& (this.autoRefresh = setTimeout((): any => _this.generateTokenFromRefreshToken(scopes), 60000)); //(token.expires_in - 300) * 1000));
		return (this.token);
	}

	public toString(): string {
		return (JSON.stringify(this.token, null, 4));
	}

	public static async build(): Promise<ThreeLeggedClient> {
		const threeLeggedClient: ThreeLeggedClient = new ThreeLeggedClient(sdkmanager);
		threeLeggedClient.token = await DataMgr.instance.data('3legged');
		// if ( threeLeggedClient.expired)
		// 	await threeLeggedClient.generateToken();
		return (threeLeggedClient);
	}

	public generateUrl(scopes: Scopes[] = [Scopes.DataRead], state?: string): string {
		return (this.authenticationClient.authorize(
			AppSettings.apsClientId,
			ResponseType.Code,
			AppSettings.apsCallback,
			scopes,
			{ state, }
		));
	}

	public static async threeLegged(cmd: string, scopes: string, options: any): Promise<void> {
		!options.debug && (sdkmanager.logger = new TLogger());
		const threeLeggedClient: ThreeLeggedClient = await ThreeLeggedClient.build();
		if (!scopes && !['token', 'refresh'].includes(cmd)) {
			scopes = cmd;
			cmd = 'token';
		}
		cmd === 'token' && await threeLeggedClient.getToken(scopes, options);
		cmd === 'decode' && await threeLeggedClient.decode(options);
		cmd === 'verify' && await threeLeggedClient.verify(options);
	}

	protected async getToken(scopes: string, options: any): Promise<ThreeLeggedToken | null> {
		try {
			let _scopes: Scopes[] = SimplifiedScopes.string2Scopes(scopes);
			const url: string = this.generateUrl(_scopes, 'localhost');
			await open(url);
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
						server.close();
						resolve(query.query.code as string || '');
					}
				});
			server.listen(AppSettings.PORT);
		}));
	}

}

export default ThreeLeggedClient;
