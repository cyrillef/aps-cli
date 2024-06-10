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

import _path from 'path';
import _url, { UrlWithParsedQuery } from 'url';
import moment from 'moment';
import cliProgress from 'cli-progress';

import { ApiResponse, SdkManager, SdkManagerBuilder } from '@aps_sdk/autodesk-sdkmanager'
import { AuthenticationClient, ResponseType, Scopes, TokenTypeHint, TwoLeggedToken } from '@aps_sdk/authentication';

import AppSettings from '@/app/app-settings';
import { sdkmanager } from '@/aps';
import DataMgr from '@/utils/dataMgr';
import { BucketObjects, Buckets, BucketsItems, GetBucketsRegionEnum, ObjectDetails, OssClient } from '@aps_sdk/oss';
import TLogger from '@/utils/logger';
import { assert } from 'console';
import { Manifest, ModelDerivativeClient, References, ReferencesPayload, SpecifyReferences } from '@aps_sdk/model-derivative';
import URN from './urn';

export class ModelDerivativesClient {

	private sdkmanager: SdkManager | null = null;
	private client: ModelDerivativeClient | null = null;

	protected constructor(sdkmanager: SdkManager) {
		this.sdkmanager = sdkmanager;
		this.client = new ModelDerivativeClient(this.sdkmanager);
	}

	public static async derivatives(cmd: string, options: any): Promise<void> {
		!options.debug && (sdkmanager.logger = new TLogger());
		const mdClient: ModelDerivativesClient = new ModelDerivativesClient(sdkmanager);
		cmd === 'manifest' && await mdClient.manifest(options);
		cmd === 'set-references' && await mdClient.setReferences(options);
	}

	protected async decodeOptions(options: any): Promise<any> {
		const credentials: TwoLeggedToken = await DataMgr.instance.data('2legged');
		let urn: string = options.urn || await DataMgr.instance.data('urn') || '';
		const region: GetBucketsRegionEnum = (options.region || GetBucketsRegionEnum.Us) as GetBucketsRegionEnum;
		if (!options.urn) {
			const bucketKey: string = options.bucket || await DataMgr.instance.data('bucket') || '';
			const key: string = options.key || await DataMgr.instance.data('object-key') || '';
			urn = URN.build(bucketKey, key).safeBase64;
		}
		urn = URN.base64ToSafeBase64(urn);
		if (!urn)
			throw new Error('urn|bucket|key parameters not set!')
		return ({
			credentials,
			region,
			urn,
		});
	}

	protected async manifest(options: any): Promise<Manifest | undefined> {
		try {
			const { credentials, region, urn }: { credentials: TwoLeggedToken, region: GetBucketsRegionEnum, urn: string }
				= await this.decodeOptions(options);

			const result: Manifest | undefined = await this.client?.getManifest(
				credentials.access_token as string,
				urn,
				{ region }
			);

			options.verbose && console.log(JSON.stringify(result, null, 4));
			//!options.verbose && console.log(``);

			return (result);
		} catch (error: any) {
			console.error(error.message);
			return (undefined);
		}
	}

	protected async setReferences(options: any): Promise<SpecifyReferences | undefined> {
		try {
			const { credentials, region, urn }: { credentials: TwoLeggedToken, region: GetBucketsRegionEnum, urn: string }
				= await this.decodeOptions(options);
			const references: string = options.references || '';
			if (!references)
				throw new Error('references parameter not set!');
			const specifyReferences: ReferencesPayload = {
				urn: URN.toString(urn),
				fileName: _path.basename(URN.toString(urn)),
				references: new Set<References>(),
			};
			let json: any = {};
			try {
				json = JSON.parse(references);
				specifyReferences.references = json;
			} catch (ex: any) {
				references.split(',').map((item: string): void => {
					const ref: string[] = item.split('|');
					const reference: References = {
						urn: URN.build(ref[0].split(':')[0], ref[0].split(':')[1]).urn,
						relativePath: ref[1],
						fileName: ref[1],
					};
					specifyReferences.references.add(reference);
					specifyReferences.references = specifyReferences.references.
				});
			}

			const result: SpecifyReferences | undefined = await this.client?.specifyReferences(
				credentials.access_token as string,
				urn,
				specifyReferences,
				{ region }
			);

			options.verbose && console.log(JSON.stringify(result, null, 4));
			//!options.verbose && console.log(``);

			return (result);
		} catch (error: any) {
			console.error(error.message);
			return (undefined);
		}
	}

}

export default ModelDerivativesClient;
