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
import TLogger, { errorMessage } from '@/utils/logger';
import TwoLeggedClient from '@/oauth/2legged';

export class BucketsClient {

	private client: OssClient;

	protected constructor(private sdkmanager: SdkManager) {
		this.client = new OssClient(this.sdkmanager);
	}

	public static async buckets(cmd: string, bucket: string, options: any): Promise<void> {
		!options.debug && (sdkmanager.logger = new TLogger());

		const region: GetBucketsRegionEnum = (options.region || GetBucketsRegionEnum.Us) as GetBucketsRegionEnum;
		const credentials: TwoLeggedClient = await TwoLeggedClient.build();
		if (!credentials || credentials.expired)
			throw new Error('Requires a valid token!');

		const bucketsClient: BucketsClient = new BucketsClient(sdkmanager);
		cmd === 'ls' && await bucketsClient.ls(credentials, region, options);
		cmd === 'current' && await bucketsClient.current(credentials, bucket, options);
	}

	protected async ls(credentials: TwoLeggedClient, region: GetBucketsRegionEnum, options: any): Promise<Buckets | null> {
		try {
			let buckets: Buckets = {
				items: [],
				next: '', // Sajith - next should be optional (ie:  'next'?: string;)
			};
			for (let startAt: string | undefined = undefined; ;) {
				const response: Buckets = await this.client.getBuckets(
					credentials.access_token, // Sajith - needs to be string | () => string
					{
						...options,
						region,
						limit: 100,
						startAt,
					}
				);
				if (!response || response.items.length === 0)
					break;
				buckets.items = [...buckets.items, ...response.items];
				startAt = response.next;
				if (!startAt)
					break;
			}
			options.json && console.log(JSON.stringify(buckets.items, null, 4));
			if (options.text) {
				const tmp: any[] = buckets.items.map(
					(elt: BucketsItems): any => ({
						...elt,
						createdDate: moment(elt.createdDate).format('YYYY-MM-DD'),
					}));
				console.table(tmp);
			}
			return (buckets);
		} catch (error: any) {
			return (errorMessage(error, options));
		}
	}

	protected async current(credentials: TwoLeggedClient, bucket: string, options: any): Promise<string | null> {
		try {
			let bucketKey: string = await DataMgr.instance.data('bucket') || '';
			if (bucket !== undefined) {
				bucketKey = bucket;
				await DataMgr.instance.store('bucket', bucket);
			}

			options.json && console.log(JSON.stringify(bucketKey, null, 4));
			options.text && console.log(`Current Bucket Key: ${bucketKey || '<undefined>'}`);

			return (bucketKey);
		} catch (error: any) {
			return (errorMessage(error, options));
		}
	}

}

export default BucketsClient;
