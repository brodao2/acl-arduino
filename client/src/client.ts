import * as vscode from "vscode";
import path = require("path");
import fse = require("fs-extra");
import { AcLabConfig } from "./acl-config";
import {
  CloseAction,
  ErrorAction,
  InitializeError,
  LanguageClient,
  Message,
  ResponseError,
  RevealOutputChannelOn,
  ServerOptions,
  TransportKind,
  LanguageClientOptions,
  StateChangeEvent,
  State,
} from "vscode-languageclient/node";
import { AclProtocol } from "./protocol";
import { Semaphore } from "./util/semaphore";
import { IConfigModel, ConfigModel } from "./model/config-model";
import { AcLabUtil } from './util/acLabUtil';
import { DEFAULT_SETUP_OPTIONS, SetupOptions } from './util/acLabArduino';

let crashCount: number = 0;
/**
 * ACLab Arduino Extension Interface
 */
export class Client implements vscode.Disposable {
  static debugPort: number = 6010;
  static updateMapSemaphore: Semaphore = new Semaphore("updateMap", 1);
  static isFirstTime: boolean = true;

  private _disposable: vscode.Disposable[];
  private _context: vscode.ExtensionContext;
  private _clientMap: Map<string, AclProtocol> = new Map();
  private _modelMap: Map<string, IConfigModel> = new Map();
  private _outputChannel: vscode.OutputChannel;
  private _traceOutputChannel: vscode.OutputChannel;

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
    this._disposable = [];
  }

  dispose() {
    this.stopAllClient();
    this._clientMap = undefined;

    this._disposable.forEach((value: vscode.Disposable) => {
      value.dispose();
    });
  }

  /**
   * Start LS client
   *
   */

  private startClient(uri: vscode.Uri): AclProtocol {
    let result: AclProtocol;

    try {
      const wfFolder: vscode.WorkspaceFolder =
        vscode.workspace.getWorkspaceFolder(uri);

      const languageClient = this.buildLanguageClient(wfFolder);
      languageClient.start().then(() => {

      });

      this._disposable.push(
        languageClient.onDidChangeState((state: StateChangeEvent) => {
          if (state.newState !== state.oldState) {
            if (state.newState == State.Stopped) {
              console.log(`LC stoping ${wfFolder.name}`);
              this.stopClient(uri);
            } else if (state.newState == State.Starting) {
              console.log(`LC starting ${wfFolder.name}`);
            } else if (state.newState == State.Running) {
              console.log(`LC running ${wfFolder.name}`);
            }
          }
        }, languageClient)
      );

      // languageClient.onReady().then(() => {
      //   console.log(`LC ready ${wfFolder.name}`);
      // });

      result = AclProtocol.initialize(wfFolder, languageClient);
    } finally {
    }

    return result;
  }

  async stopClient(uri: vscode.Uri): Promise<void> {
    const lock = await Client.updateMapSemaphore.acquire();
    let promise: Promise<void> = Promise.resolve();

    try {
      const key: vscode.WorkspaceFolder =
        vscode.workspace.getWorkspaceFolder(uri);
      if (!this._clientMap.has(key.name)) {
        console.log(`LC not mapped ${key.name}`);
        return;
      }
      console.log(`LC unmapped ${key.name}`);

      const client: AclProtocol = this._clientMap.get(key.name);

      if (client) {
        this._clientMap.delete(key.name);

        if (client.languageClient.diagnostics) {
          client.languageClient.diagnostics.clear();
        }

        promise = client.languageClient.stop();
      }
    } finally {
      lock.release();
    }

    return promise;
  }

  async stopAllClient(): Promise<void> {
    const promises: Thenable<void>[] = [];

    if (this._clientMap) {
      Object.keys(this._clientMap).forEach(async (key: string) => {
        promises.push(this.stopClient(vscode.Uri.parse(key)));
      });
    }

    return Promise.all(promises).then(() => undefined);
  }

  private buildLanguageClient(folder: vscode.WorkspaceFolder): LanguageClient {
    const runOptions: string[] = [
      "--log--level",
      AcLabConfig.logLevel(),
      `${AcLabConfig.isLogToFile() ? "--log-to-file" : ""}`,
      `${AcLabConfig.isShowBanner() && Client.isFirstTime
        ? ""
        : "--no-show-banner"
      }`,
      "--traceLevel",
      AcLabConfig.traceLevel(),
    ];
    Client.isFirstTime = false;

    const documentSelector: any[] = [];
    documentSelector.push({
      scheme: "file",
      language: "ino",
      pattern: `${folder.uri.fsPath}/**/*.ino`,
    });
    documentSelector.push({
      scheme: "file",
      pattern: `${folder.uri.fsPath}/.vscode/aclabarduino.json`,
    });
    // documentSelector.push({
    //   scheme: "untitled",
    //   language: "ino",
    //   pattern: "./**/*.ino",
    // });
    const serverModule: string = this._context.asAbsolutePath(
      path.join(".", "server", "out", "server.js")
    );
    const debugOptions = {
      execArgv: [
        "--nolazy", //não aguarda "attach" do depurador
        `--inspect=${Client.debugPort}`,
        "--inspect-brk",
      ],
    };
    Client.debugPort = Client.debugPort + 1;

    const serverOptions: ServerOptions = {
      run: {
        module: serverModule,
        transport: TransportKind.ipc,
        args: runOptions,
      },
      debug: {
        module: serverModule,
        transport: TransportKind.ipc,
        args: runOptions,
        options: debugOptions,
      },
    };

    const fileEvents: vscode.FileSystemWatcher[] = [];

    fileEvents.push(
      vscode.workspace.createFileSystemWatcher(
        `**/.vscode/aclabarduino.json`,
        true,
        true,
        true
      )
    );

    fileEvents.push(
      vscode.workspace.createFileSystemWatcher("**/*.ino", true, true, true)
    );

    const clientOptions: LanguageClientOptions = {
      initializationOptions: {
        workspaceFolder: folder.uri.toString(),
      },
      documentSelector: documentSelector,
      uriConverters: {
        code2Protocol: (uri: vscode.Uri): string =>
          (uri.scheme ? uri : uri.with({ scheme: "file" })).toString(),
        protocol2Code: (uri: string) => vscode.Uri.parse(uri),
      },
      initializationFailedHandler: (
        error: ResponseError<InitializeError>
      ): boolean => {
        vscode.window.showErrorMessage(
          `The language server is not able to serve any features. Initialization failed: ${error}.`
        );
        return false;
      },
      // errorHandler: {
      //   error: (error: Error, message: Message, count: number): ErrorAction => {
      //     vscode.window.showErrorMessage(
      //       `(${count})Error communicating with the language server: ${error}: ${message}.`
      //     );
      //     if (count < 3) {
      //       return ErrorAction.Continue;
      //     }
      //     return ErrorAction.Shutdown;
      //   },
      //   closed: (): CloseAction => {
      //     crashCount++;
      //     if (crashCount < 3) {
      //       return CloseAction.Restart;
      //     }
      //     return CloseAction.DoNotRestart;
      //   },
      // },
      synchronize: {
        fileEvents: fileEvents,
      },
      diagnosticCollectionName: "aclArduino",
      outputChannel: this.outputChannel,
      traceOutputChannel: this.traceOutputChannel,
      revealOutputChannelOn: RevealOutputChannelOn.Warn,
      //stdioEncoding?: string;
      progressOnInitialization: false,
      //workspaceFolder: folder,
      //   connectionOptions: {
      //     cancellationStrategy: CancellationStrategy;
      //     maxRestartCount: 3
      // },
      markdown: {
        isTrusted: true,
      },
      // middleware: {
      //   provideCompletionItem: (
      //     document: any,
      //     position /*:VPosition*/,
      //     context /*:VCompletionContext*/,
      //     token: CancellationToken,
      //     next: ProvideCompletionItemsSignature
      //   ) => {
      //     return null;
      //   },
      //   resolveCompletionItem: (
      //     item: any /*VCompletionItem*/,
      //     token: CancellationToken,
      //     next: ResolveCompletionItemSignature
      //   ) => {
      //     //: ProviderResult<VCompletionItem>

      //     return null;
      //   },
      // },
    };

    return new LanguageClient(
      "acLabServer",
      "AC Lab Service",
      serverOptions,
      clientOptions
      //false
    );
  }

  get outputChannel() {
    if (!this._outputChannel) {
      this._outputChannel = vscode.window.createOutputChannel("AC Lab Service");
    }

    return this._outputChannel;
  }

  get traceOutputChannel() {
    //return this.outputChannel;
    if (AcLabConfig.traceLevel() !== "off") {
      if (!this._traceOutputChannel) {
        if (AcLabConfig.traceLevel() == "verbose") {
          this._traceOutputChannel = vscode.window.createOutputChannel(
            "AC Lab Service (trace)"
          );
        } else {
          this._traceOutputChannel = this.outputChannel;
        }
      }
    }

    return this._traceOutputChannel;
  }

  getDefaultProtocol(): AclProtocol {
    return this.getProtocol(vscode.workspace.workspaceFolders[0].uri);
  }

  hasProtocol(uri: vscode.Uri): boolean {
    const key: vscode.WorkspaceFolder =
      vscode.workspace.getWorkspaceFolder(uri);

    return this._clientMap.has(key.name);
  }

  hasModel(workspace: vscode.WorkspaceFolder): boolean {
    return this._modelMap.has(workspace.name);
  }

  getModel(workspace: vscode.WorkspaceFolder): IConfigModel {
    if (!this.hasModel(workspace)) {
      const model: IConfigModel = this.buildModel(workspace);
      this._modelMap.set(workspace.name, model);
    }

    return this._modelMap.get(workspace.name);
  }

  removeModel(workspace: vscode.WorkspaceFolder): void {
    if (this.hasModel(workspace)) {
      this._modelMap.delete(workspace.name);
    }
  }

  private buildModel(workspace: vscode.WorkspaceFolder): IConfigModel {
    return ConfigModel.create(workspace.uri);
  }

  getProtocol(uri: vscode.Uri): AclProtocol {
    const key: vscode.WorkspaceFolder =
      vscode.workspace.getWorkspaceFolder(uri);

    const lock = Client.updateMapSemaphore.acquire();
    try {
      if (!this.hasProtocol(uri)) {
        const protocol: AclProtocol = this.startClient(uri);
        this._clientMap.set(key.name, protocol);
      }
    } finally {
      lock.then((lock: any) => lock.release());
    }

    return this._clientMap.get(key.name);
  }
}

export class AcLabArduino2 {
  private _util: AcLabUtil | undefined;
  private _setupOptions: SetupOptions;

  constructor(options?: Partial<SetupOptions>) {
    this._setupOptions = { ...DEFAULT_SETUP_OPTIONS, ...options };
    this._util = undefined;
  }

  public get util(): AcLabUtil {
    if (!this._util) {
      this._util = new AcLabUtil();
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
      fse.ensureLinkSync(src, dest);
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

export const acLabArduino2: AcLabArduino2 = new AcLabArduino2();
