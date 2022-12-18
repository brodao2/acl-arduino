import {
  Diagnostic,
  DiagnosticSeverity,
  Range,
} from "vscode-languageserver/node";

export namespace ArduinoDiagnostic {
  
  export enum Error {
    E001_INVALID_CLI_VERSION = "E001",
    E002_INVALID_BOARD = "E002",
    E003_INVALID_PLATFORM_VERSION = "E003",
    E004_INVALID_PORT = "E004",    
    E031_PLATFORM_NOT_INSTALED = "E031",
    E099_ARDUIONO_CLI = "E099"
  }

  export enum Information {
    I001_PLATFORM_VERSION_NOT_LATEST = "I001"
      }
          //const NO_RANGE: Range = Range.create(0, 0, 0, 0);

  export function INVALID_ARDUINO_CLI(
    resource: string,
    range: Range,
    last: string
  ): Diagnostic {
    return createDiagnostic(
      DiagnosticSeverity.Error,
      Error.E001_INVALID_CLI_VERSION,
      "Invalid Arduino-CLI version.",
      resource,
      range,
      last
    );
  }

  export function INVALID_BOARD(
    resource: string,
    range: Range,
    reason: string
  ): Diagnostic {
    return createDiagnostic(
      DiagnosticSeverity.Error,
      Error.E002_INVALID_BOARD,
      `Invalid board. ${reason}`,
      resource,
      range
    );
  }

  export function INVALID_PLATFORM_VERSION(
    resource: string,
    range: Range,
    versions: string[]
  ): Diagnostic {
    return createDiagnostic(
      DiagnosticSeverity.Error,
      Error.E003_INVALID_PLATFORM_VERSION,
      "Invalid platform version.",
      resource,
      range,
      versions
    );
  }


export function createProjectDiagnostic(workspace: string, range: Range, code: Error | Information, message: string, data: any): Diagnostic
  {
    return createDiagnostic(DiagnosticSeverity.Error, code, message, workspace, range, data);
  }

function createDiagnostic(
  severity: DiagnosticSeverity,
  code: string,
  message: string,
  source: string,
  range: Range,
  data?: any
): Diagnostic {
  return {
    range: range,
    severity: severity,
    code: code,
    message: message,
    source: source,
    //codeDescription: CodeDescription;
    //tags?: DiagnosticTag[];
    //relatedInformation?: DiagnosticRelatedInformation[];
    data: data,
  };
}
}