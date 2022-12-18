import * as fs from 'fs-extra';
import * as path from 'path';
import { Unpack } from './unpack';
import * as child_process from 'child_process';
import stream = require('stream');
import { promisify } from 'util';

const download = require('download');
const homedir = require('os').homedir();
const aclHome = path.join(homedir, '.aclabarduino');

export interface RunOptions {
  /** version of VSCode to test against, defaults to latest */
  vscodeVersion?: string;
  /** path to custom settings json file */
  settings?: string;
  /** remove the extension's directory as well (if present) */
  cleanup?: boolean;
  /** path to a custom mocha configuration file */
  config?: string;
  /** logging level of the Webdriver */
  //    logLevel?: logging.Level;
  /** try to perform all setup without internet connection, needs all requirements pre-downloaded manually */
  offline?: boolean;
}

/** defaults for the [[RunOptions]] */
export const DEFAULT_RUN_OPTIONS = {
  vscodeVersion: 'latest',
  settings: '',
  //    logLevel: logging.Level.INFO,
  offline: false,
};

/**
 * Handles the VS Code instance used for testing.
 * Includes downloading, unpacking, launching, and version checks.
 */
export class AcLabUtil {
  //private codeFolder: string;
  private downloadPlatform: string;
  private downloadFolder: string;
  private _executablePath!: string;
  private availableVersions: any;
  private _arduinoCliFolder!: string;
  //private _cliPath!: string;
  private arduinoCliVersion!: string;
  private aclHome: string;

  /**
   * Create an instance of code handler
   * @param folder Path to folder where all the artifacts will be stored.
   */
  constructor(home: string = aclHome) {
    this.downloadPlatform = this.getPlatform();
    this.aclHome = home;
    this._arduinoCliFolder = path.join(home, 'arduino-cli');
    this.downloadFolder = path.join(this.arduinoCliFolder, 'download');
    this.availableVersions = this.getArduinoCliVersions();

    this.findExecutables();
  }

  public get arduinoCliFolder(): string {
    return this._arduinoCliFolder;
  }

  public get executablePath(): string {
    return this._executablePath;
  }

  /**
   * Get all versions for the given release stream
   */
  getArduinoCliVersions(): any {
    const platform: string = this.getPlatform();
    const baseUrl: string =
      'https://github.com/arduino/arduino-cli/releases/download';

    return {
      latest: `https://downloads.arduino.cc/arduino-cli/arduino-cli_latest_${platform}bit.zip`,
      '0.18.3': `${baseUrl}/0.18.3/arduino-cli_0.18.3_${platform}bit.zip`,
      '0.18.2': `${baseUrl}/0.18.2/arduino-cli_0.18.2_${platform}bit.zip`,
    };
  }

  /**
   * Download and unpack Arduino-CLI
   *
   * @param version Arduino-CLI version to get, default latest
   */
  async downloadArduinoCli(version: string): Promise<boolean> {
    let result: boolean = true;

    fs.mkdirpSync(this.downloadFolder);

    const url = this.getArduinoCliVersions()[version];
    const isTarGz = this.downloadPlatform.indexOf('linux') > -1;
    const fileName = `${path.basename(url)}${isTarGz ? __filename.replace('.zip', '.tar.gz') : ''
      }`;

    console.log(`Downloading Arduino-CLI from: ${url}`);

    fs.writeFileSync(path.join(this.downloadFolder, fileName), await download(url));

    if (result) {
      const target: string = path.join(this.arduinoCliFolder, version);
      console.log(`Unpacking Arduino-CLI into ${target}`);
      if (!fs.pathExistsSync(target)) {
        fs.mkdirSync(target);
      }
      await Unpack.unpack(path.join(this.downloadFolder, fileName), target);
    }

    return Promise.resolve(result);
  }

  /**
   * Check if VS Code exists in local cache along with an appropriate version of chromedriver
   * without internet connection
   */
  checkRequirements(): boolean {
    this.arduinoCliVersion = this.getExistingArduinoCliVersion();

    return this.arduinoCliVersion.length > 0;
  }

  /**
   * Check if given version is available in the given stream
   */
  checkVersion(version: string): string {
    if (this.availableVersions.length < 1) {
      this.availableVersions = this.getArduinoCliVersions();
    }

    if (Object.keys(this.availableVersions).indexOf(version) < 0) {
      throw new Error(
        `Version ${version} is not supported for use in this extension`
      );
    }

    return this.availableVersions[version];
  }

  /**
   * Check what VS Code version is present in the testing folder
   */
  getExistingArduinoCliVersion(): string {
    let version: string = '';

    try {
      const command = [this.executablePath, 'version'].join(' ');
      const buffer: Buffer = child_process.execSync(command);

      version = buffer.toString().split('\n')[0];
    } catch (error) {
      console.error(error);
    }

    return version;
  }

  /**
   * Construct the platform string based on OS
   */
  private getPlatform(): string {
    let platform: string = process.platform;
    const arch = process.arch;

    if (platform === 'linux') {
      platform = arch === 'x64' ? `Linux_64` : `Linux_64`;
    } else if (platform === 'win32') {
      platform = arch === 'x64' ? `Windows_64` : 'Windows_32';
    }

    return platform;
  }

  /**
   * Setup paths specific to used OS
   */
  private findExecutables(): void {
    let cliPath = '';

    switch (process.platform) {
      case 'darwin':
        // this.executablePath = path.join(
        //   this.arduinoCliFolder,
        //   "Contents",
        //   "MacOS",
        //   "Electron"
        // );
        // this._cliPath = path.join(
        //   this.arduinoCliFolder,
        //   "Contents",
        //   "Resources",
        //   "app",
        //   "out",
        //   "cli.js"
        // );
        break;
      case 'win32':
        cliPath = path.join(this.aclHome, 'arduino-ci.exe');
        break;
      case 'linux':
        cliPath = path.join(this.aclHome, 'arduino-ci');
        break;
    }

    this._executablePath = cliPath;
  }

  /**
   * Parse JSON from a file
   * @param path path to json file
   */
  private parseSettings(path: string): Object {
    if (!path) {
      return {};
    }
    let text = '';
    try {
      text = fs.readFileSync(path).toString();
    } catch (err) {
      throw new Error(`Unable to read settings from ${path}:\n ${err}`);
    }
    try {
      return JSON.parse(text);
    } catch (err) {
      throw new Error(`Error parsing the settings file from ${path}:\n ${err}`);
    }
  }
}
