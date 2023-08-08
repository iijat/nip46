import { NostrRelay2ClientMessage_EVENT } from "../nostrRelay2ClientMessage";

export enum Nip46RequestMethod {
  /** APP to SIGNER */
  get_public_key = "get_public_key",

  /** APP to SIGNER */
  sign_event = "sign_event",

  /** APP to SIGNER */
  describe = "describe",

  /** APP to SIGNER */
  delegate = "delegate",

  /** SIGNER to APP */
  connect = "connect",
}

export type Nip46Request = {
  id: string;
  method: Nip46RequestMethod;
  params: any[];
};

export interface Nip46RequestExt extends Nip46Request {
  event: NostrRelay2ClientMessage_EVENT;
}

export interface Nip46Response {
  id: string;
  result: any;
  error?: string | null;
}

export interface Nip46ResponseExt extends Nip46Response {
  event: NostrRelay2ClientMessage_EVENT;
}

export class Nip46Message {
  readonly event: NostrRelay2ClientMessage_EVENT;
  readonly json: any;

  getAsRequestExt(): Nip46RequestExt | undefined {
    if (
      typeof this.json.id === "string" &&
      typeof this.json.method !== "undefined" &&
      typeof this.json.params !== "undefined" &&
      Array.isArray(this.json.params)
    ) {
      return {
        event: this.event,
        ...(this.json as Nip46Request),
      };
    }

    return undefined;
  }

  getAsResponseExt(): Nip46ResponseExt | undefined {
    if (
      typeof this.json.id === "string" &&
      typeof this.json.result !== "undefined"
    ) {
      return {
        event: this.event,
        ...(this.json as Nip46Response),
      };
    }

    return undefined;
  }

  constructor(
    event: NostrRelay2ClientMessage_EVENT,
    decryptedContentJson: any
  ) {
    this.json = decryptedContentJson;
    this.event = event;
  }
}

export type Nip46DelegateRequestParams = [
  string,
  {
    kind: number;
    since: number;
    until: number;
  }
];

export type Nip46DelegateResponseResult = {
  from: string;
  to: string;
  cond: string;
  sig: string;
};
