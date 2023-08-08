import { EventEmitter } from "events";
import { Nip46Socket, Nip46SocketEvent } from "./nip46Socket";
import {
  Event,
  EventTemplate,
  UnsignedEvent,
  getEventHash,
  getPublicKey,
  getSignature,
  nip04,
} from "nostr-tools";
import { Nip46Uri } from "./nip46Uri";
import {
  Nip46DelegateRequestParams,
  Nip46Request,
  Nip46RequestExt,
  Nip46RequestMethod,
} from "./typeDefs";
import { v4 } from "uuid";

export enum Nip46AppEvent {
  IncomingRequest_connect = "connect",
}

export class Nip46App {
  // #region Public Properties

  readonly events = new EventEmitter();

  // #endregion Public Properties

  // #region Private Properties

  private _nip46Socket: Nip46Socket;
  private _app: Nip46Uri;
  private _appPrivkey: string;
  private _appPubkey: string;
  private _signerPubkey: string | undefined;

  // #endregion Private Properties

  constructor(app: Nip46Uri, appPrivkey: string) {
    this._appPrivkey = appPrivkey;
    this._appPubkey = getPublicKey(appPrivkey);
    this._app = app;
    this._nip46Socket = new Nip46Socket(app.relay, appPrivkey);
    this._nip46Socket.events.on(
      Nip46SocketEvent.RequestReceived,
      this._nip46OnRequest.bind(this)
    );
  }

  // #region Public Methods

  async goOnline(): Promise<void> {
    await this._nip46Socket.goOnline();
  }

  goOffline(): void {
    this._nip46Socket.goOffline();
  }

  async sendDescribe(): Promise<string[]> {
    return await this._request(Nip46RequestMethod.describe, [], true);
  }

  async sendGetPublicKey(): Promise<string> {
    return await this._request(Nip46RequestMethod.get_public_key, [], true);
  }

  async sendSignEvent(eventTemplate: EventTemplate): Promise<Event> {
    return await this._request(
      Nip46RequestMethod.sign_event,
      [eventTemplate],
      true
    );
  }

  async sendDelegate(params: Nip46DelegateRequestParams) {
    return await this._request(Nip46RequestMethod.delegate, params, true);
  }

  // #endregion Public Methods

  // #region Private Methods

  private _nip46OnRequest(
    nostrNip46Socket: Nip46Socket,
    nip46RequestExt: Nip46RequestExt
  ) {
    switch (nip46RequestExt.method) {
      case Nip46RequestMethod.connect:
        // Extract and store the pubkey of the signer.
        this._signerPubkey = nip46RequestExt.params[0];
        this.events.emit(
          Nip46AppEvent.IncomingRequest_connect,
          this._signerPubkey
        );
        break;

      default:
        break;
    }
  }

  private async _request(
    method: Nip46RequestMethod,
    params: any[],
    waitForResponse: boolean
  ): Promise<any> {
    if (!this._signerPubkey) {
      throw new Error(
        "No pubkey available from the signer. No connect received before?"
      );
    }

    const requestId = v4();

    const request: Nip46Request = {
      id: requestId,
      method,
      params,
    };

    const contentUnencrypted = JSON.stringify(request);
    const contentEncrypted = await nip04.encrypt(
      this._appPrivkey,
      this._signerPubkey,
      contentUnencrypted
    );

    // Continue after successful content encryption.
    const event: UnsignedEvent<24133> = {
      kind: 24133,
      pubkey: this._appPubkey,
      tags: [["p", this._signerPubkey]],
      created_at: Math.floor(Date.now() / 1000),
      content: contentEncrypted,
    };

    const id = getEventHash(event);
    const sig = getSignature(event, this._appPrivkey);

    const signedEvent = {
      id,
      sig,
      ...event,
    };

    await this._nip46Socket.sendEvent(signedEvent);

    // Continue after successful send.
    // Wait for response if required.
    if (!waitForResponse) {
      return;
    }
    return await this._nip46Socket.waitForResponse(requestId);
  }

  // #endregion Private Methods
}
