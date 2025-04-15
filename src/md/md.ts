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

import { SdkManager, StaticAuthenticationProvider } from '@aps_sdk/autodesk-sdkmanager'
import { TwoLeggedToken } from '@aps_sdk/authentication';

import { sdkManager } from '@/aps';
import DataMgr from '@/utils/dataMgr';
import { Region } from '@aps_sdk/oss';
import TLogger, { errorMessage } from '@/utils/logger';
import {
	Job, JobPayload, JobPayloadFormat, Manifest, ManifestDerivative, ManifestResources,
	ModelDerivativeClient, OutputType, SpecifyReferences, SpecifyReferencesPayload,
	SpecifyReferencesPayloadReferences, View, XAdsDerivativeFormat
} from '@aps_sdk/model-derivative';
import URN from '@/md/urn';
import TwoLeggedClient from '@/oauth/2legged';
import AuthenticationProvider from '@/oauth/oauth-provider';

export class ModelDerivativesClient {

	private client: ModelDerivativeClient;

	protected constructor(private sdkManager: SdkManager, authenticationProvider: AuthenticationProvider) {
		this.client = new ModelDerivativeClient({
			sdkManager,
			authenticationProvider,
		});
	}

	public static async derivatives(cmd: string, options: any): Promise<void> {
		!options.debug && (sdkManager.logger = new TLogger());

		const storageKey: string | undefined = options.credentials;
		const authenticationProvider: AuthenticationProvider = await AuthenticationProvider.build(storageKey);

		const mdClient: ModelDerivativesClient = new ModelDerivativesClient(sdkManager, authenticationProvider);
		cmd === 'manifest' && await mdClient.manifest(options);
		cmd === 'set-references' && await mdClient.setReferences(options);
		cmd === 'invoke' && await mdClient.invoke(options);
	}

	protected async decodeOptions(options: any): Promise<any> {
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
			region,
			urn,
		});
	}

	protected async manifest(options: any): Promise<Manifest | null> {
		try {
			const { region, urn }: { region: Region, urn: string }
				= await this.decodeOptions(options);

			const response: Manifest = await this.client.getManifest(
				urn,
				{ region, }
			);

			options.json && console.log(JSON.stringify(response, null, 4));
			if (options.text) {
				console.log(`Status: ${response?.status} [${response?.progress}]`);
				response?.derivatives.map((derivative: ManifestDerivative, index: number): void => {
					console.log(`${index} - ${derivative.name} <${derivative.outputType}>: Status: ${derivative?.status} [${derivative?.progress}]`);

					derivative?.children?.map((child: ManifestResources): void => {
						console.log(`   > ${child.role} - ${child.name || ''} <${child.guid}>: Status: ${child?.status} [${child?.progress || 'complete'}]`);

						[...child?.children || []].map((subchild: ManifestResources): void => {
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

	protected async setReferences(options: any): Promise<SpecifyReferences | null> {
		try {
			const { region, urn }: { region: Region, urn: string }
				= await this.decodeOptions(options);
			const references: string = options.references || '';
			if (!references)
				throw new Error('references parameter not set!');
			const specifyReferences: SpecifyReferencesPayload = {
				urn: URN.toString(urn),
				//fileName: _path.basename(URN.toString(urn)),
				references: []
			} as SpecifyReferencesPayload;
			let json: any = {};
			try {
				json = JSON.parse(references);
				specifyReferences.references = json;
			} catch (ex: any) {
				references.split(',').map((item: string): void => {
					const ref: string[] = item.split('|');
					const reference: SpecifyReferencesPayloadReferences = {
						urn: URN.build(ref[0].split(':')[0], ref[0].split(':')[1]).urn,
						//relativePath: ref[1],
						//fileName: ref[1],
					} as SpecifyReferencesPayloadReferences;
					specifyReferences.references.push(reference);
				});
			}

			const response: SpecifyReferences = await this.client.specifyReferences(
				urn,
				specifyReferences,
				{ region, }
			);

			options.json && console.log(JSON.stringify(response, null, 4));
			options.text && console.log(response?.result || '<unknown>');

			return (response);
		} catch (error: any) {
			return (errorMessage(error, options));
		}
	}

	protected async invoke(options: any): Promise<Job | null> {
		try {
			const { region, urn }: { region: Region, urn: string }
				= await this.decodeOptions(options);
			const xAdsForce: boolean = options.force;
			const xAdsDerivativeFormat: XAdsDerivativeFormat | undefined = undefined;
			const checkReferences: boolean = options.checkReferences;
			const master: string = options.master;

			const svf2OutputFormat: JobPayloadFormat = {
				views: [View._2d, View._3d],
				type: OutputType.Svf2,
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
				job,
				{ region, xAdsForce, xAdsDerivativeFormat, }
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
