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

export class URN {

	public constructor(protected bucket?: string, protected key?: string) {
		//return (`urn:adsk.objects:os.object:${bucket}/${key}`);
	}

	public static build(bucket: string, key: string): URN {
		const urn: URN = new URN(bucket, key);
		return (urn);
	}

	public get urn(): string {
		return (`urn:adsk.objects:os.object:${this.bucket}/${this.key}`);
	}

	public get base64(): string {
		return (
			Buffer.from(this.urn)
				.toString('base64')
		);
	}

	public get safeBase64(): string {
		return (
			Buffer.from(this.urn)
				.toString('base64')
				.replace(/\+/g, '-') // Convert '+' to '-'
				.replace(/\//g, '_') // Convert '/' to '_'
				.replace(/=+$/, '')
		);
	}

	static safeBase64ToBase64(safeBase64: string): string {
		// Removed '=' at end
		safeBase64 += Array(5 - safeBase64.length % 4).join('=');
		safeBase64 = safeBase64
			.replace(/-/g, '+') // Convert '-' to '+'
			.replace(/_/g, '/'); // Convert '_' to '/'
		return (safeBase64);
	}

	static base64ToSafeBase64(base64: string): string {
		return (base64
			.replace(/\+/g, '-') // Convert '+' to '-'
			.replace(/\//g, '_') // Convert '/' to '_'
			.replace(/=+$/, '')
		);
	}

	static toString(base64: string): string {
		// Add removed at end '='
		base64 += Array(5 - base64.length % 4).join('=');
		base64 = base64
			.replace(/-/g, '+') // Convert '-' to '+'
			.replace(/_/g, '/'); // Convert '_' to '/'
		return (Buffer.from(base64, 'base64').toString());
	}

}

export default URN;
