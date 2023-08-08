import { EventEmitter } from "events";
import { Nip46Uri } from "./nip46Uri";
import {
  Nip46DelegateRequestParams,
  Nip46DelegateResponseResult,
  Nip46Request,
  Nip46RequestMethod,
} from "./typeDefs";
import { v4 } from "uuid";
import {
  UnsignedEvent,
  nip04,
  getPublicKey,
  getEventHash,
  getSignature,
  Event,
  EventTemplate,
} from "nostr-tools";
import { Nip46RequestExt, Nip46Response } from "./typeDefs";
import { Nip46Socket, Nip46SocketEvent } from "./nip46Socket";
import { BaseSocketEvent } from "../../socket/baseSocket";

export enum Nip46SignerEvent {
  IncomingRequest_get_public_key = "get_public_key",
  IncomingRequest_describe = "describe",
  IncomingRequest_sign_event = "sign_event",
  IncomingRequest_delegate = "delegate",
}

export class Nip46Signer {
  // #region Public Properties

  readonly events = new EventEmitter();

  // #endregion Public Properties

  // #region Private Properties

  private _apps: Nip46Uri[] = [];
  private _relayNip46Sockets = new Map<string, Nip46Socket>();
  private _signerPrivkey: string;
  private _signerPubkey: string;

  // #endregion Private Properties

  constructor(signerPrivkey: string) {
    this._signerPrivkey = signerPrivkey;
    this._signerPubkey = getPublicKey(signerPrivkey);
  }

  // #region Public Methods

  // addApp(app: NostrConnectUri) {
  //   if (this._apps.find((x) => x.toURI() === app.toURI())) {
  //     return;
  //   }

  //   this._apps.push(app);
  //   if (this._relayNostrNip46Sockets.has(app.relay)) {
  //     return;
  //   }

  //   this._relayNostrNip46Sockets.set(
  //     app.relay,
  //     new NostrNip46Socket(app.relay, this._signerPrivkey)
  //   );
  // }

  async goOnline(app: Nip46Uri): Promise<void> {
    await this.getNip46Socket(app).goOnline();
  }

  async sendConnect(app: Nip46Uri) {
    await this._request(
      app,
      Nip46RequestMethod.connect,
      [this._signerPubkey],
      false
    );
  }

  async sendGetPublicKeyResponse(
    app: Nip46Uri,
    requestId: string,
    pubkey: string | null,
    errorMessage: string | undefined
  ) {
    if (pubkey) {
      await this._response(app, requestId, pubkey, null);
    } else {
      await this._response(app, requestId, null, errorMessage);
    }
  }

  async sendDescribeResponse(app: Nip46Uri, requestId: string) {
    await this._response(
      app,
      requestId,
      ["describe", "connect", "get_public_key", "sign_event", "delegate"],
      null
    );
  }

  async sendSignEventResponse(
    app: Nip46Uri,
    requestId: string,
    signedEvent: Event | null,
    errorMessage: string | undefined
  ) {
    if (signedEvent) {
      await this._response(app, requestId, signedEvent, null);
    } else {
      await this._response(app, requestId, null, errorMessage);
    }
  }

  async sendDelegateResponse(
    app: Nip46Uri,
    requestId: string,
    result: Nip46DelegateResponseResult | null,
    errorMessage: string | undefined
  ) {
    if (result) {
      await this._response(app, requestId, result, null);
    } else {
      await this._response(app, requestId, null, errorMessage);
    }
  }

  // #endregion Public Methods

  // #region Private Methods

  getNip46Socket(app: Nip46Uri): Nip46Socket {
    if (!this._apps.find((x) => x.toURI() === app.toURI())) {
      this._apps.push(app);
    }

    let nip46Socket = this._relayNip46Sockets.get(app.relay);
    if (!nip46Socket) {
      nip46Socket = new Nip46Socket(app.relay, this._signerPrivkey);
      this._relayNip46Sockets.set(app.relay, nip46Socket);

      nip46Socket.events.on(
        Nip46SocketEvent.RequestReceived,
        this._nip46OnRequest.bind(this)
      );

      nip46Socket.events.on(BaseSocketEvent.Close, () => {
        console.log("Socket CLOSE");
      });

      nip46Socket.events.on(
        BaseSocketEvent.Error,
        (event: WebSocketEventMap["error"]) => {
          console.log("Socket ERROR");
          console.log(event);
        }
      );
    }
    return nip46Socket;
  }

  private _nip46OnRequest(
    nostrNip46Socket: Nip46Socket,
    nip46RequestExt: Nip46RequestExt
  ) {
    // Determine the right app.
    const app = this._apps.find(
      (x) =>
        x.relay === nostrNip46Socket.getRelay() &&
        x.pubkey === nip46RequestExt.event.event.pubkey
    );

    if (!app) {
      console.log("ERROR: Could not determine app for incoming request.");
      return;
    }

    switch (nip46RequestExt.method) {
      case Nip46RequestMethod.get_public_key:
        this.events.emit(
          Nip46SignerEvent.IncomingRequest_get_public_key,
          app,
          nip46RequestExt.id
        );
        break;

      case Nip46RequestMethod.describe:
        // Special request that the library answers itself.
        this.sendDescribeResponse(app, nip46RequestExt.id);
        break;

      case Nip46RequestMethod.sign_event:
        this.events.emit(
          Nip46SignerEvent.IncomingRequest_sign_event,
          app,
          nip46RequestExt.id,
          nip46RequestExt.params[0] as EventTemplate
        );
        break;

      case Nip46RequestMethod.delegate:
        this.events.emit(
          Nip46SignerEvent.IncomingRequest_delegate,
          app,
          nip46RequestExt.id,
          nip46RequestExt.params as Nip46DelegateRequestParams
        );
        break;

      default:
        break;
    }
  }

  private async _response(
    app: Nip46Uri,
    id: string,
    result: any,
    error: string | undefined | null
  ) {
    const nostrNip46Socket = this.getNip46Socket(app);
    const response: Nip46Response = {
      id,
      result,
      error,
    };

    const contentUnencrypted = JSON.stringify(response);
    const contentEncrypted = await nip04.encrypt(
      this._signerPrivkey,
      app.pubkey,
      contentUnencrypted
    );

    const event: UnsignedEvent<24133> = {
      kind: 24133,
      pubkey: this._signerPubkey,
      tags: [["p", app.pubkey]],
      created_at: Math.floor(Date.now() / 1000),
      content: contentEncrypted,
    };

    const hashId = getEventHash(event);
    const sig = getSignature(event, this._signerPrivkey);

    const signedEvent = {
      id: hashId,
      sig,
      ...event,
    };

    await nostrNip46Socket.sendEvent(signedEvent);
  }

  private async _request(
    app: Nip46Uri,
    method: Nip46RequestMethod,
    params: any[],
    waitForResponse: boolean
  ): Promise<any> {
    const requestId = v4();
    const nip46Socket = this.getNip46Socket(app);

    const request: Nip46Request = {
      id: requestId,
      method,
      params,
    };

    const contentUnencrypted = JSON.stringify(request);
    const contentEncrypted = await nip04.encrypt(
      this._signerPrivkey,
      app.pubkey,
      contentUnencrypted
    );

    // Continue after successful content encryption.
    const event: UnsignedEvent<24133> = {
      kind: 24133,
      pubkey: this._signerPubkey,
      tags: [["p", app.pubkey]],
      created_at: Math.floor(Date.now() / 1000),
      content: contentEncrypted,
    };

    const id = getEventHash(event);
    const sig = getSignature(event, this._signerPrivkey);

    const signedEvent = {
      id,
      sig,
      ...event,
    };

    await nip46Socket.sendEvent(signedEvent);

    // Continue after successful send.
    // Wait for response if required.
    if (!waitForResponse) {
      return;
    }
    return await nip46Socket.waitForResponse(requestId);
  }

  // #endregion Private Methods
}
