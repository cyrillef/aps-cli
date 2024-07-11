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

import _fs from 'fs/promises';
import _path from 'path';

export class DataMgr {

	private static _instance: DataMgr | null = null;
	private _data: any = {};

	private constructor() {
	}

	public static get instance(): DataMgr {
		!DataMgr._instance && (DataMgr._instance = new DataMgr());
		return (DataMgr._instance);
	}

	public async data(key: string): Promise<any> {
		!this._data[key] && (this._data[key] = await DataMgr.read(key));
		return (this._data[key]);
	}

	public async store(key: string, data: any): Promise<void> {
		this._data[key] = data;
		await DataMgr.save(key, data);
	}

	public async clear(key: string): Promise<void> {
		try {
			delete this._data[key];
			const path: string = _path.resolve(__dirname, `../../data/${key}.json`);
			await _fs.unlink(path);
		} catch (ex: any) {
		}
	}

	protected static async read(key: string): Promise<any> {
		try {
			const path: string = _path.resolve(__dirname, `../../data/${key}.json`);
			const buffer: Buffer = await _fs.readFile(path);
			const json: any = JSON.parse(buffer.toString('utf-8'));
			return (json);
		} catch (ex: any) {
			return (null);
		}
	}

	protected static async save(key: string, data: any): Promise<void> {
		const path: string = _path.resolve(__dirname, `../../data/${key}.json`);
		await _fs.writeFile(path, JSON.stringify(data, null, 4));
	}

}

export default DataMgr;
