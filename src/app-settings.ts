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
/*jshint esversion: 9 */

import _path from 'path';

const APPLICATION_VERSION: string = '1.0.0.0';

const AppSettings: any = {

	__dev: (process.env.NODE_ENV !== 'production'),
	__test: (process.env.NODE_ENV === 'test'),

	TEMP: _path.resolve(`${__dirname}/../temp`), // at runtime it is in /bin. This variable has the trailing /

	PORT: parseInt(<string>process.env.PORT, 10) || 3001,
	SessionSecret: `${process.env.APS_CLIENT_ID || 'your_client_id'}${process.env.SALT || 'B3x%'}`,

	// APS
	apsClientId: process.env.APS_CLIENT_ID || 'your_client_id',
	apsClientSecret: process.env.APS_CLIENT_SECRET || 'your_client_secret',
	apsCallback: process.env.APS_CALLBACK || ('http://localhost:' + (parseInt(<string>process.env.PORT, 10) || 3001) + '/user/callback'),
	apsScope: 'user-profile:read',

	Version: APPLICATION_VERSION,
};

export default AppSettings;