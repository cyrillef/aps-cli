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
import { sdkManager } from '@/aps';
import DataMgr from '@/utils/dataMgr';
import { BucketObjects, Buckets, BucketsItems, ObjectDetails, OssClient } from '@aps_sdk/oss';
import TLogger, { errorMessage } from '@/utils/logger';
import { assert } from 'console';
import TwoLeggedClient from '@/oauth/2legged';
import AuthenticationProvider from '@/oauth/oauth-provider';
import ThreeLeggedClient from '@/oauth/3legged';

export class ObjectsClient {

	private client: OssClient;

	protected constructor(private sdkManager: SdkManager, authenticationProvider: AuthenticationProvider) {
		this.client = new OssClient({
			sdkManager,
			authenticationProvider,
		});
	}

	public static async objects(cmd: string, name: string, options: any): Promise<void> {
		!options.debug && (sdkManager.logger = new TLogger());

		const storageKey: string | undefined = options.credentials;
		const authenticationProvider: AuthenticationProvider = await AuthenticationProvider.build(storageKey);

		const objectsClient: ObjectsClient = new ObjectsClient(sdkManager, authenticationProvider);
		cmd === 'ls' && await objectsClient.ls(options);
		cmd === 'current' && await objectsClient.current(name, options);
		cmd === 'put-object' && await objectsClient.putObject(name, options);
		cmd === 'get-object-details' && await objectsClient.getObjectDetails(name, options);
	}

	protected async ls(options: any): Promise<BucketObjects | null> {
		try {
			const bucketKey: string = options.bucket || await DataMgr.instance.data('bucket');

			const objectList: BucketObjects = { // Sajith - It is strange to use BucketObjects here
				items: [],
			};
			for (let startAt: string | undefined = undefined; ;) {
				const response: BucketObjects = await this.client.getObjects(
					bucketKey,
					{
						...options,
						limit: 100,
						startAt,
					}
				);
				if (!response || !response.items || response.items?.length === 0)
					break;
				objectList.items = [...(objectList.items || []), ...response.items];

				const url_parts: UrlWithParsedQuery = _url.parse(response.next || '', true);
				startAt = url_parts.query.startAt as string;
				if (!startAt)
					break;
			}
			options.json && console.log(JSON.stringify(objectList.items, null, 4));
			if (options.text) {
				const tmp: any[] = (objectList.items || []).map( // Sajith - workaround because it is noted as optional :()
					(elt: /*ObjectDetails*/any): any => {
						delete elt.bucketKey;
						delete elt.objectId;
						delete elt.contentType;
						delete elt.location;
						elt.size = `${((elt.size || 0) / 1024 / 1024).toFixed(2)} mb`;
						return (elt);
					}
				);
				console.table(tmp);
			}
			return (objectList);
		} catch (error: any) {
			return (errorMessage(error, options));
		}

	}

	protected async current(name: string, options: any): Promise<string | null> {
		try {
			let objectKey: string = await DataMgr.instance.data('object-key') || '';
			if (name !== undefined) {
				objectKey = name;
				await DataMgr.instance.store('object-key', name);
			}

			options.json && console.log(JSON.stringify(objectKey, null, 4));
			options.text && console.log(`Current Object Key: ${objectKey || '<undefined>'}`);

			return (objectKey);
		} catch (error: any) {
			return (errorMessage(error, options));
		}
	}

	protected async putObject(name: string, options: any): Promise<ObjectDetails | null> {
		try {
			const bucketKey: string = options.bucket || await DataMgr.instance.data('bucket') || '';
			await DataMgr.instance.store('bucket', bucketKey);
			const filename: string = options.body;
			const objectKey: string = name || _path.basename(filename);
			await DataMgr.instance.store('object-key', objectKey);

			const progress: cliProgress.SingleBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
			options.progress && progress.start(100, 0);
			const details: ObjectDetails = await this.client.uploadObject(
				bucketKey,
				objectKey,
				filename,
				{
					onProgress: (percentCompleted: number): void => {
						//console.log(percentCompleted);
						options.progress && progress.update(percentCompleted);
					}
				}
			);
			options.progress && progress.stop();

			options.json && console.log(JSON.stringify(details, null, 4));
			options.text && console.log(`Object loaded: ${details?.objectKey} (${((details?.size || 0) / 1024 / 1024).toFixed(2)} mb)`);

			return (details);
		} catch (error: any) {
			return (errorMessage(error, options));
		}
	}

	protected async getObjectDetails(name: string, options: any): Promise<ObjectDetails | null> {
		try {
			const bucketKey: string = options.bucket || await DataMgr.instance.data('bucket') || '';
			const objectKey: string = name || await DataMgr.instance.data('object-key') || '';

			const details: ObjectDetails = await this.client.getObjectDetails(
				bucketKey,
				objectKey,
				{ // todo
					// ifModifiedSince?: string | undefined;
					// xAdsAcmNamespace?: string | undefined;
					// xAdsAcmCheckGroups?: string | undefined;
					// xAdsAcmGroups?: string | undefined;
					// _with?: GetObjectDetailsWithEnum | undefined;
				}
			);

			options.json && console.log(JSON.stringify(details, null, 4));
			options.text && console.log(`Object Information: ${details?.objectKey} (${((details?.size || 0) / 1024 / 1024).toFixed(2)} mb) (sha1: ${details?.sha1})`);

			return (details);
		} catch (error: any) {
			return (errorMessage(error, options));
		}
	}

}

export default ObjectsClient;
