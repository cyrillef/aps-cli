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
import TwoLeggedClient from '@/oauth/2legged';

export class ModelDerivativesClient {

	private client: ModelDerivativeClient;

	protected constructor(private sdkmanager: SdkManager) {
		this.client = new ModelDerivativeClient(this.sdkmanager);
	}

	public static async derivatives(cmd: string, options: any): Promise<void> {
		!options.debug && (sdkmanager.logger = new TLogger());

		const credentials: TwoLeggedClient = await TwoLeggedClient.build();
		if (!credentials || credentials.expired)
			throw new Error('Requires a valid token!');

		const mdClient: ModelDerivativesClient = new ModelDerivativesClient(sdkmanager);
		cmd === 'manifest' && await mdClient.manifest(credentials, options);
		cmd === 'set-references' && await mdClient.setReferences(credentials, options);
		cmd === 'invoke' && await mdClient.invoke(credentials, options);
	}

	protected async decodeOptions(options: any): Promise<any> {
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
			region,
			urn,
		});
	}

	protected async manifest(credentials: TwoLeggedClient, options: any): Promise<Manifest | null> {
		try {
			const { region, urn }: { region: GetBucketsRegionEnum, urn: string }
				= await this.decodeOptions(options);

			const response: Manifest = await this.client.getManifest(
				credentials.access_token, // Sajith - needs to be string | () => string
				urn,
				{ region }
			);

			options.json && console.log(JSON.stringify(response, null, 4));
			if (options.text) {
				console.log(`Status: ${response?.status} [${response?.progress}]`);
				response?.derivatives.map((derivative: ManifestDerivatives, index: number): void => {
					console.log(`${index} - ${derivative.name} <${derivative.outputType}>: Status: ${derivative?.status} [${derivative?.progress}]`);

					derivative?.children?.map((child: ManifestDerivativesChildren): void => {
						console.log(`   > ${child.role} - ${child.name || ''} <${child.guid}>: Status: ${child?.status} [${child?.progress || 'complete'}]`);

						[...child?.children || []].map((subchild: ManifestDerivativesChildren): void => {
							console.log(`     * ${subchild.type} - ${subchild.role} <${subchild.guid}>: ${(subchild as any)?.urn || ''}`); // Sajith - missing optional property 'urn' on ManifestDerivativesChildren
						});
					});
				});
			}

			return (response);
		} catch (error: any) {
			return (errorMessage(error, options));
		}
	}

	protected async setReferences(credentials: TwoLeggedClient, options: any): Promise<SpecifyReferences | null> {
		try {
			const { region, urn }: { region: GetBucketsRegionEnum, urn: string }
				= await this.decodeOptions(options);
			const references: string = options.references || '';
			if (!references)
				throw new Error('references parameter not set!');
			const specifyReferences: ReferencesPayload = {
				urn: URN.toString(urn),
				//fileName: _path.basename(URN.toString(urn)),
				references: new Set<References>(),
			} as ReferencesPayload;
			let json: any = {};
			try {
				json = JSON.parse(references);
				specifyReferences.references = json;
			} catch (ex: any) {
				references.split(',').map((item: string): void => {
					const ref: string[] = item.split('|');
					const reference: References = {
						urn: URN.build(ref[0].split(':')[0], ref[0].split(':')[1]).urn,
						//relativePath: ref[1],
						//fileName: ref[1],
					} as References;
					specifyReferences.references.add(reference);
				});
				specifyReferences.references = [...specifyReferences.references.values()] as any as Set<References>;
			}

			const response: SpecifyReferences = await this.client.specifyReferences(
				credentials.access_token, // Sajith - needs to be string | () => string
				urn,
				specifyReferences,
				{ region }
			);

			options.json && console.log(JSON.stringify(response, null, 4));
			options.text && console.log(response?.result || '<unknown>');

			return (response);
		} catch (error: any) {
			return (errorMessage(error, options));
		}
	}

	protected async invoke(credentials: TwoLeggedClient, options: any): Promise<Job | null> {
		try {
			const { region, urn }: { region: GetBucketsRegionEnum, urn: string }
				= await this.decodeOptions(options);
			const xAdsForce: boolean = options.force;
			const xAdsDerivativeFormat: XAdsDerivativeFormat | undefined = undefined;
			const checkReferences: boolean = options.checkReferences;
			const master: string = options.master;

			const svf2OutputFormat: JobSvf2OutputFormat = {
				views: [View._2d, View._3d],
				type: Type.Svf2,
				// optional advanced options
				//advanced: <JobSvf2OutputFormatAdvancedRVT>{ _2dviews: Model2dView.Legacy, generateMasterViews: true, extractorVersion: ExtractorVersion.Next }
			};

			const job: JobPayload = {
				input: {
					urn,
					checkReferences,
					// Sajith - fails uppercase N - documentation says rootFilename
					rootFilename: master,
					compressedUrn: !!master,
				},
				output: {
					// JobPayloadFormat: JobPayloadFormat = JobDwgOutputFormat | JobIfcOutputFormat | JobIgesOutputFormat | JobObjOutputFormat | JobStepOutputFormat | JobStlOutputFormat | JobSvf2OutputFormat | JobSvfOutputFormat | JobThumbnailOutputFormat
					formats: [svf2OutputFormat]
				},
			};

			console.log(JSON.stringify(job, null, 4))

			const response: Job = await this.client.startJob(
				credentials.access_token, // Sajith - needs to be string | () => string
				job,
				{ region, xAdsForce, xAdsDerivativeFormat }
			);

			options.json && console.log(JSON.stringify(response, null, 4));
			options.text && console.log(response?.result || '<unknown>');

			return (response);
		} catch (error: any) {
			return (errorMessage(error, options));
		}
	}

}

export default ModelDerivativesClient;
