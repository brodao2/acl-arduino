import path = require('path');
import fs = require('fs-extra');
import { AcLabUtil } from './acLabUtil';

const homedir = require('os').homedir();
const aclHome = path.join(homedir, '.aclabarduino');

export interface SetupOptions {
	arduinoCliVersion: string;
	optionsFile: string;
	dontAskMore: boolean;
}

export const DEFAULT_SETUP_OPTIONS = {
	arduinoCliVersion: 'latest',
	optionsFile: path.join('.', '.acLabArduino'),
	dontAskMore: false,
};

/**
 * ACLab Arduino Extension Interface
 */
export class AcLabArduino {
	private _util: AcLabUtil | undefined;
	private _setupOptions: SetupOptions;

	constructor(options?: Partial<SetupOptions>) {
		this._setupOptions = { ...DEFAULT_SETUP_OPTIONS, ...options };
		this._util = undefined;
	}

	public get util(): AcLabUtil {
		if (!this._util) {
			this._util = new AcLabUtil(aclHome);
		}

		return this._util;
	}

	/**
	 * Configure links to selected version
	 * @param version version to download, default latest
	 */
	configRunCode(version: string): boolean {
		try {
			const src: string = path.join(
				this.util.arduinoCliFolder,
				version,
				'arduino-cli.exe'
			);
			const dest: string = this.util.executablePath;
			fs.ensureLinkSync(src, dest);
		} catch (error) {
			console.error(error);
			return false;
		}

		return true;
	}

	/**
	 * Download Arduino-CLI of given version
	 * @param version version to download, default latest
	 */
	downloadCode(version: string): Promise<boolean> {
		this.util.checkVersion(version);

		if (this.util.getExistingArduinoCliVersion() !== version) {
			return this.util.downloadArduinoCli(version);
		} else {
			console.log('Arduino-CLI exists in local cache, skipping download');
		}

		return Promise.resolve(true);
	}

	/**
	 * Performs all necessary setup:
	 * - getting Arduino-CLI
	 * - default preferences
	 *
	 * @param _options Additional options for setting up the tests
	 */
	async setupRequirements(_options?: Partial<SetupOptions>): Promise<boolean> {
		this._setupOptions = { ...DEFAULT_SETUP_OPTIONS, ..._options };
		this._util = undefined;

		const result = await this.downloadCode(
			this._setupOptions.arduinoCliVersion
		);
		return (
			result &&
			this.configRunCode(this._setupOptions.arduinoCliVersion) &&
			this.checkRequirementsAsync()
		);
	}

	/**
	 * Verify requirements async
	 *
	 */
	checkRequirementsAsync(): boolean {
		return this.util.checkRequirements();
	}

	/**
	 * Verify requirements
	 *
	 */
	checkRequirements(): Promise<boolean> {
		return new Promise((resolve) => {
			resolve(this.util.checkRequirements());
		});
	}
}

//export const acLabArduino: AcLabArduino = new AcLabArduino();
