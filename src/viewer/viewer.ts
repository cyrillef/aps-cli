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

import { SdkManager } from '@aps_sdk/autodesk-sdkmanager'
import { TwoLeggedToken } from '@aps_sdk/authentication';

import { sdkmanager } from '@/aps';
import DataMgr from '@/utils/dataMgr';
import { GetBucketsRegionEnum } from '@aps_sdk/oss';
import TLogger, { errorMessage } from '@/utils/logger';
import { ExtractorVersion, Job, JobPayload, JobSvf2OutputFormat, JobSvf2OutputFormatAdvancedRVT, JobSvfOutputFormat, Manifest, ManifestDerivatives, ManifestDerivativesChildren, Model2dView, ModelDerivativeClient, References, ReferencesPayload, SpecifyReferences, Type, View, XAdsDerivativeFormat } from '@aps_sdk/model-derivative';
import URN from '@/md/urn';

export class ViewerClient {

	protected constructor() {
	}

	public static async viewer(cmd: string, options: any): Promise<void> {
		!options.debug && (sdkmanager.logger = new TLogger());
		const viewerClient: ViewerClient = new ViewerClient();
		cmd === 'create' && await viewerClient.create(options);
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

	protected async create(options: any): Promise<boolean> {
		try {
			const { credentials, region, urn }: { credentials: TwoLeggedToken, region: GetBucketsRegionEnum, urn: string }
				= await this.decodeOptions(options);

			return (true);
		} catch (error: any) {
			return (errorMessage(error, options) !== undefined);
		}
	}




}

export default ViewerClient;
