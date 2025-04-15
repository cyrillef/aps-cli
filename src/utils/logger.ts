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

import { ILogger } from '@aps_sdk/autodesk-sdkmanager';

// Sajith - ILogger is not exposed :( cannot implement the interface when creating my own
//import { ILogger } from '@aps_sdk/autodesk-sdkmanager';

export class TLogger implements ILogger {

	constructor() { }

	initLogger(): void { }
	logInfo(msg: string): void { }
	logWarn(msg: string): void { }
	logError(msg: string): void { }
	logDebug(msg: string): void { }

	setEnabled(enabled: boolean): void {}
}

export const errorMessage: (error: any, options: any) => null
	= (error: any, options: any): null => {
		// todo
		console.error(error.message);
		options.json && !options.debug && console.error(error.axiosError.response.data.diagnostic || '');
		options.debug && console.error(JSON.stringify(error.axiosError.response.data.diagnostic || '', null, 4));
		return (null);
	}

export default TLogger;
