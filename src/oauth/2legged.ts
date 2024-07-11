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

import { SdkManager } from '@aps_sdk/autodesk-sdkmanager'
import { AuthenticationClient, Scopes, TwoLeggedToken } from '@aps_sdk/authentication';

import AppSettings from '@/app/app-settings';
import { sdkmanager } from '@/aps';
import DataMgr from '@/utils/dataMgr';
import TLogger, { errorMessage } from '@/utils/logger';
import SimplifiedScopes from '@/oauth/scopes';

export class TwoLeggedClient {

	private authenticationClient: AuthenticationClient;
	private autoRefresh: NodeJS.Timeout | null = null;
	private _token: TwoLeggedToken | null = null;
	private _scopes: Scopes[] = [Scopes.ViewablesRead];

	protected constructor(private sdkmanager: SdkManager) {
		this.authenticationClient = new AuthenticationClient(this.sdkmanager);
	}

	// Sajith - TwoLeggedToken has all its properties optionals - that is incorrect
	// and it would be nice to add a expires_at?: number; optional properties calculated automatically
	public get token(): TwoLeggedToken | null { return (this._token); }
	protected set token(token: TwoLeggedToken | null) { this._token = token; }

	public get expired(): boolean { return (!this.token || moment().isAfter(moment((this.token as any).expires_at * 1000))); }
	public get access_token(): string {
		if (this.token && moment().isBefore(moment((this.token as any).expires_at * 1000)))
			return (this.token.access_token as string);
		throw new Error('Requires a valid token!');
	}

	// Sajith - I add to create my own auto-refresh logic
	protected async generateToken(scopes: Scopes[] = [Scopes.DataRead], autoRefresh: boolean = true): Promise<TwoLeggedToken> {
		const token: TwoLeggedToken | undefined = await this.authenticationClient.getTwoLeggedToken(
			AppSettings.apsClientId,
			AppSettings.apsClientSecret,
			scopes
		) || {};
		token.expires_in = token.expires_in || 0;
		(token as any).expires_at = token.expires_in + moment().unix();
		//console.log('expires_at: ' + moment(1000 * (token as any).expires_at).format('HH:mm:ss'));
		this.token = token;
		DataMgr.instance.store('2legged', token)

		const _this: TwoLeggedClient = this;
		this.autoRefresh && clearTimeout(this.autoRefresh);
		this.autoRefresh = null;
		autoRefresh
			&& token.expires_in
			&& (this.autoRefresh = setTimeout((): any => _this.generateToken(scopes), 60000)); //(token.expires_in - 300) * 1000));
		return (this.token);
	}

	public toString(): string {
		return (JSON.stringify(this.token, null, 4));
	}

	public static async build(): Promise<TwoLeggedClient> {
		const twoLeggedClient: TwoLeggedClient = new TwoLeggedClient(sdkmanager);
		twoLeggedClient.token = await DataMgr.instance.data('2legged');
		// if ( twoLeggedClient.expired)
		// 	await twoLeggedClient.generateToken();
		return (twoLeggedClient);
	}

	public static async twoLegged(cmd: string, scopes: string, options: any): Promise<void> {
		!options.debug && (sdkmanager.logger = new TLogger());
		const twoLeggedClient: TwoLeggedClient = await TwoLeggedClient.build();
		if (!scopes && !['token', 'decode', 'verify'].includes(cmd)) {
			scopes = cmd;
			cmd = 'token';
		}
		cmd === 'token' && await twoLeggedClient.getToken(scopes, options);
		cmd === 'decode' && await twoLeggedClient.decode(options);
		cmd === 'verify' && await twoLeggedClient.verify(options);
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

	protected async decode(options: any, silent: boolean = false): Promise<jwt.Jwt | null> {
		try {
			const credentials: TwoLeggedToken = await DataMgr.instance.data('2legged');
			const decoded: jwt.Jwt | null = jwt.decode(credentials.access_token as string, { complete: true });

			options.json && !silent && console.log(JSON.stringify(decoded, null, 4));
			if (options.text && !silent) {
				console.log('Token');
				if (!decoded || typeof decoded === 'string')
					console.log(`\t- ${decoded}`);
				else if (decoded?.payload && typeof decoded?.payload === 'string') {
					console.log(`\t- ${decoded?.payload}`);
				} else {
					console.log(`\tClient ID: ${(decoded?.payload as jwt.JwtPayload).client_id}`);
					console.log(`\tScopes: ${(decoded?.payload as jwt.JwtPayload).scope.join(' ')}`);
				}
			}
			return (decoded);
		} catch (error: any) {
			return (errorMessage(error, options));
		}
	}

	protected async verify(options: any): Promise<jwt.Jwt | null> {
		try {
			const credentials: TwoLeggedToken = await DataMgr.instance.data('2legged');
			const decoded: jwt.Jwt | null = jwt.decode(credentials.access_token as string, { complete: true });

			const header: jwt.JwtHeader | undefined = decoded?.header;

			const _verify: (access_token: string, header: jwt.JwtHeader | undefined) => Promise<Jwt | undefined>
				= (access_token: string, header: jwt.JwtHeader | undefined): Promise<Jwt | undefined> => {
					return (new Promise((resolve: (value: Jwt | undefined) => void, reject: (reason?: any) => void): void => {

						const getKey: GetPublicKeyOrSecret = (header: JwtHeader, callback: SigningKeyCallback): void => {
							const well_known_jwks_url = 'https://developer.api.autodesk.com/authentication/v2/keys';
							const client = jwksClient({ jwksUri: well_known_jwks_url });
							client.getSigningKey(header?.kid, (err: Error | null, key?: jwksClient.SigningKey | undefined): void => {
								const signingKey: string | undefined = key?.getPublicKey();
								//console.log(`signingKey ${signingKey}`);
								callback(null, signingKey);
							});
						};

						jwt.verify(
							access_token,
							getKey,
							{
								algorithms: ['RS256'],
								complete: true,
								...header
							},
							(error: VerifyErrors | null, fullyDecoded: Jwt | JwtPayload | string | undefined): void => {
								// This will display the decoded JWT token.
								//console.log(`fullyDecoded ${JSON.stringify(fullyDecoded, null, 4)}`);
								if (typeof fullyDecoded !== 'undefined' && fullyDecoded) {
									// console.log('Valid token');
									// console.log(JSON.stringify(fullyDecoded, null, 4));
									resolve(fullyDecoded as Jwt);
								} else {
									//console.error('Invalid token');
									reject();
								}
							}
						);

					}));
				};

			const results: Jwt | undefined = await _verify(credentials.access_token as string, header);

			options.json && console.log(JSON.stringify(results, null, 4));
			if (options.text) {
				console.log('Valid token');
				console.log(`\tClient ID: ${(results?.payload as any).client_id}`);
				console.log(`\tScopes: ${(results?.payload as any).scope.join(' ')}`);
			}

			return (decoded);
		} catch (error: any) {
			console.log('Invalid token');
			return (null);
		}
	}

}

export default TwoLeggedClient;
