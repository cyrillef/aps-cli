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
import _url from 'url';

import { TwoLeggedToken } from '@aps_sdk/authentication';

import { sdkManager } from '@/aps';
import DataMgr from '@/utils/dataMgr';
import TLogger, { errorMessage } from '@/utils/logger';
import URN from '@/md/urn';
import { Region } from '@aps_sdk/oss';
import TwoLeggedClient from '@/oauth/2legged';
import { SdkManager } from '@aps_sdk/autodesk-sdkmanager';

export class ViewerClient {

	protected constructor(private sdkmanager: SdkManager) {
	}

	public static async viewer(cmd: string, options: any): Promise<void> {
		!options.debug && (sdkManager.logger = new TLogger());
		const viewerClient: ViewerClient = new ViewerClient(sdkManager);
		cmd === 'create' && await viewerClient.create(options);
	}

	protected async decodeOptions(options: any): Promise<any> {
		// const credentials: TwoLeggedToken = await DataMgr.instance.data(((this.sdkmanager as any)._authClient as any).storageKey);
		const credentials: TwoLeggedClient = await TwoLeggedClient.build();
		if (!credentials || credentials.expired)
			throw new Error('Requires a valid token!');

		let urn: string = options.urn || await DataMgr.instance.data('urn') || '';
		const region: Region = (options.region || Region.Us) as Region;
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

	protected async create(options: any): Promise<boolean> {
		try {
			const { credentials, region, urn }: { credentials: TwoLeggedToken, region: Region, urn: string }
				= await this.decodeOptions(options);

			return (true);
		} catch (error: any) {
			return (errorMessage(error, options) !== undefined);
		}
	}

}

export default ViewerClient;
