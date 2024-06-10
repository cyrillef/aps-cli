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

import { ApiResponse, SdkManager, SdkManagerBuilder } from '@aps_sdk/autodesk-sdkmanager'
import { AuthenticationClient, ResponseType, Scopes, TokenTypeHint, TwoLeggedToken } from '@aps_sdk/authentication';

import AppSettings from '@/app/app-settings';
import { sdkmanager } from '@/aps';
import DataMgr from '@/utils/dataMgr';
import { Buckets, BucketsItems, GetBucketsRegionEnum, OssClient } from '@aps_sdk/oss';
import TLogger from '@/utils/logger';

export class BucketsClient {

	private sdkmanager: SdkManager | null = null;
	private client: OssClient | null = null;

	protected constructor(sdkmanager: SdkManager) {
		this.sdkmanager = sdkmanager;
		this.client = new OssClient(this.sdkmanager);
	}

	public static async buckets(cmd: string, bucket: string, options: any): Promise<void> {
		!options.debug && (sdkmanager.logger = new TLogger());
		const bucketsClient: BucketsClient = new BucketsClient(sdkmanager);
		const region: GetBucketsRegionEnum = (options.region || GetBucketsRegionEnum.Us) as GetBucketsRegionEnum;
		cmd === 'ls' && await bucketsClient.ls(region, options);
		cmd === 'current' && await bucketsClient.current(bucket, options);
	}

	protected async ls(region: GetBucketsRegionEnum, options: any): Promise<Buckets | undefined> {
		try {
			// const limit: number = options.limit || 10;
			// const startAt: string = options.startAt || null;
			const credentials: TwoLeggedToken = await DataMgr.instance.data('2legged');
			let buckets: Buckets = {
				items: [],
				next: '',
			};
			for (let startAt: string | undefined = undefined; ;) {
				const results: Buckets | undefined = await this.client?.getBuckets(
					credentials.access_token as string,
					{
						...options,
						region,
						limit: 100,
						startAt,
					}
				);
				if (!results || results.items.length === 0)
					break;
				buckets.items = [...buckets.items, ...results.items];
				startAt = results.next;
				if (!startAt)
					break;
			}
			options.verbose && console.log(JSON.stringify(buckets.items, null, 4));
			if (!options.verbose) {
				const tmp: any[] = buckets.items.map(
					(elt: BucketsItems): any => ({
						...elt,
						createdDate: moment(elt.createdDate).format('YYYY-MM-DD'),
					}));
				console.table(tmp);
			}
			return (buckets);
		} catch (error: any) {
			console.error(error.message);
			return (undefined);
		}
	}

	protected async current(bucket: string, options: any): Promise<string | undefined> {
		try {
			let bucketKey: string = await DataMgr.instance.data('bucket') || '';
			if (bucket !== undefined ) {
				bucketKey = bucket;
				await DataMgr.instance.store('bucket', bucket);
			}

			options.verbose && console.log(JSON.stringify(bucketKey, null, 4));
			!options.verbose && console.log(`Current Bucket Key: ${bucketKey || '<undefined>'}`);

			return (bucketKey);
		} catch (error: any) {
			console.error(error.message);
			return (undefined);
		}
	}

}

export default BucketsClient;
