/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
	CompletionList,
	createConnection,
	Diagnostic,
	InitializeParams,
	InitializeResult,
	ProposedFeatures,
	ServerCapabilities,
	TextDocuments,
	TextDocumentSyncKind
} from 'vscode-languageserver/node';
//import { getLanguageModes, LanguageModes } from './languageModes';
import { TextDocument } from 'vscode-languageserver-textdocument';
import path = require('path');
import { resourceLimits } from 'worker_threads';

const homedir: string = require("os").homedir();
export const ACL_HOME: string = path.join(homedir, ".aclabarduino");

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
export const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

//let languageModes: LanguageModes;

connection.onInitialize((_params: InitializeParams) => {
	//languageModes = getLanguageModes();
	console.log(JSON.stringify(_params));
	// documents.onDidClose(e => {
	// 	//languageModes.onDocumentRemoved(e.document);
	// });
	// connection.onShutdown(() => {
	// 	//languageModes.dispose();
	// });

	const serverCapabilities: ServerCapabilities = {
		executeCommandProvider: {
			commands: [
				"checkRequirements"
			]
		}
	};

	const result: InitializeResult<any> = {
		capabilities: serverCapabilities,
		serverInfo: {
			name: "ACLABArduinoService",
			version: "version",
		}
	};

	return result;
});

connection.onDidChangeConfiguration(_change => {
	// Revalidate all open text documents
	documents.all().forEach(validateTextDocument);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument) {
	try {
		const version = textDocument.version;
		const diagnostics: Diagnostic[] = [];
		// if (textDocument.languageId === 'html1') {
		// 	const modes = languageModes.getAllModesInDocument(textDocument);
		// 	const latestTextDocument = documents.get(textDocument.uri);
		// 	if (latestTextDocument && latestTextDocument.version === version) {
		// 		// check no new version has come in after in after the async op
		// 		modes.forEach(mode => {
		// 			if (mode.doValidation) {
		// 				mode.doValidation(latestTextDocument).forEach(d => {
		// 					diagnostics.push(d);
		// 				});
		// 			}
		// 		});
		// 		connection.sendDiagnostics({ uri: latestTextDocument.uri, diagnostics });
		// 	}
		// }
	} catch (e) {
		connection.console.error(`Error while validating ${textDocument.uri}`);
		connection.console.error(String(e));
	}
}

connection.onCompletion(async (textDocumentPosition, token) => {
	const document = documents.get(textDocumentPosition.textDocument.uri);
	if (!document) {
		return null;
	}

	// // const mode = languageModes.getModeAtPosition(document, textDocumentPosition.position);
	// if (!mode || !mode.doComplete) {
	// 	return CompletionList.create();
	// }
	// const doComplete = mode.doComplete!;

	return null; //doComplete(document, textDocumentPosition.position);
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
