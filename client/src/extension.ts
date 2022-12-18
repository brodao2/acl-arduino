import * as vscode from 'vscode';
import * as path from 'path';
import { ExtensionContext } from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';
import { acLabArduino2, Client } from './client';

let client: LanguageClient;
export let acLabArduino: Client;

export function activate(context: ExtensionContext) {
	// The server is implemented in node
	const serverModule = context.asAbsolutePath(
		path.join('server', 'out', 'server.js')
	);
	// The debug options for the server
	// --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
	const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [{ scheme: 'file', language: 'html1' }]
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'ls-aclabmcu',
		'AC Lab Server',
		serverOptions,
		clientOptions
	);

	// Start the client. This will also launch the server
	client.start().then(() => {

	}, (reason: any) => {

	});

	console.log('Congratulations, your extension "ACLab Arduino" is now active!');

	acLabArduino2.checkRequirements().then((value: boolean) => {
		if (value) {
			vscode.window.showInformationMessage('ACLab Arduino ready!');
		} else {
			vscode.window
				.showWarningMessage(
					"Minimum requirements not met.\nRun 'ACLab: initialize'.",
					//{ modal: true },
					'Run',
					'Don´t ask more'
				)
				.then((action?: string) => {
					if (action === 'Run') {
						vscode.window.withProgress(
							{
								cancellable: true,
								location: vscode.ProgressLocation.Notification,
								title: 'Setup Requirements',
							},
							async (progress, token) => {
								progress.report({
									message: 'Setup Requirements (it may take a few minutes)',
								});

								acLabArduino2.setupRequirements().then((value: boolean) => {
									if (value) {
										progress.report({
											message: 'Setup finished.',
											increment: 100,
										});
									} else {
										progress.report({
											message: 'Setup failure.',
											increment: 100,
										});
									}
								});
							}
						);
					} else if (action === 'Don´t ask more') {
						acLabArduino2.setupRequirements({ dontAskMore: true });
					}
				});
		}
	});

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand(
		'aclabarduino.initialize',
		() => {
			// The code you place here will be executed every time your command is executed
			// Display a message box to the user
			vscode.window.showInformationMessage('Hello World from aclarduino!');
		}
	);

	context.subscriptions.push(disposable);
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
