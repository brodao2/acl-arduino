export interface IBoardServerModel {
  name: string;
  fqbn: string;
}

export interface IConfigServerModel {
  version: string;
  cliVersion: string;
  port: string;
  board: IBoardServerModel;
  alias?: string;
}

export const CONFIG_SERVER_DEFAULT: IConfigServerModel = {
  version: "",
  cliVersion: "",
  port: "",
  board: {
    fqbn: "",
    name: "",
  },
  alias: "",
};
