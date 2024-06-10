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

import 'module-alias/register';
import _path from 'path';
import _fs from 'fs';
import { Command } from 'commander';

import TLogger from '@/utils/logger';
import TwoLeggedClient from '@/oauth/2legged';
import BucketsClient from '@/oss/buckets';

import { ApsConfiguration, AdskEnvironment, ApiResponse, SdkManager, SdkManagerBuilder } from '@aps_sdk/autodesk-sdkmanager';
import { AuthenticationClient, ResponseType, Scopes, TokenTypeHint } from '@aps_sdk/authentication';
import ObjectsClient from '@/oss/objects';
import ModelDerivativesClient from '@/md/md';

export const apsConfig: ApsConfiguration = new ApsConfiguration({
	environment: AdskEnvironment.Prd,
});

export const sdkmanager: SdkManager = SdkManagerBuilder
	.create()
	.addApsConfiguration(apsConfig)
	//.addLogger(new TLogger())
	.build();

const program: Command = new Command();
program
	.name('aps')
	.description('APS CLI')
	.version('1.0.0');

program.command('2legged')
	.description('Authorization commands')
	.argument('<cmd>', 'commands: [token] | decode | verify | ')
	.argument('[scopes]', 'string to specify app context scopes \'r w br bw bd\' (default: r)')
	//.option('-u, --urn <urn...>', 'resource URN scope') // todo
	.option('-v, --verbose', 'output results')
	.option('-d, --debug', 'debug messages')
	.action(TwoLeggedClient.twoLegged);

program.command('buckets')
	.description('Bucket commands')
	.argument('<cmd>', 'commands: ls | current | ')
	.argument('[bucket]', 'bucket key')
	.option('-r, --region <region>', 'region: US | EMEA | APAC (default: US')
	.option('-v, --verbose', 'output results')
	.option('-d, --debug', 'debug messages')
	.action(BucketsClient.buckets);

program.command('objects')
	.description('Objects commands')
	.argument('<cmd>', 'commands: ls | current | put-object | get-object-details |')
	.argument('[name]', 'object key')
	.option('-b, --bucket <bucket>', 'bucket key (override default)')
	.option('-k, --key <key>', 'object key (override default)')
	.option('--body <body>', 'body to upload in the bucket')
	//.option('-s, --search <beginsWith>', 'find object beginning with') // todo
	.option('-p, --progress', 'show progress bar')
	.option('-v, --verbose', 'output results')
	.option('-d, --debug', 'debug messages')
	.action(ObjectsClient.objects);

program.command('derivatives')
	.description('Model Derivatives commands')
	.argument('<cmd>', 'commands: manifest | set-references | ')
	.option('-b, --bucket <bucket>', 'bucket key (override default)')
	.option('-k, --key <key>', 'object key (override default)')
	.option('-u, --urn <urn>', 'urn (override default)')
	.option('-r, --region <region>', 'region: US | EMEA | APAC (default: US')
	.option('--references <references>', 'references setup json or pair notation')

	.option('-p, --progress', 'show progress bar')
	.option('-v, --verbose', 'output results')
	.option('-d, --debug', 'debug messages')
	.action(ModelDerivativesClient.derivatives);

program.parse();


// (async () => {



// })();