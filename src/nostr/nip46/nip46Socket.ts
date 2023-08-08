import { v4 } from "uuid";
import { NostrSocket, NostrSocketEvent } from "../../socket/nostrSocket";
import { getPublicKey, nip04 } from "nostr-tools";
import { BaseSocketEvent } from "../../socket/baseSocket";
import { Nip46Message, Nip46Response } from "./typeDefs";
import { NostrFilters } from "../typeDefs";
import { NostrRelay2ClientMessage_EVENT } from "../nostrRelay2ClientMessage";

export enum Nip46SocketEvent {
  RequestReceived = "nip46RequestMessage",
  ResponseReceived = "nip46ResponseMessage",
}

export class Nip46Socket extends NostrSocket {
  private _subscriptionId = v4();
  private _clientPubkey: string;
  private _clientPrivkey: string;

  constructor(relay: string, clientPrivkey: string) {
    super(relay);

    this._clientPrivkey = clientPrivkey;
    this._clientPubkey = getPublicKey(clientPrivkey);

    this.events.on(BaseSocketEvent.Open, this._nip46OnOpen.bind(this));
    this.events.on(NostrSocketEvent.EVENT, this._nip46OnMessage.bind(this));
  }

  waitForResponse(
    requestId: string,
    timeoutInMs: number | undefined = 60000
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        this.events.off(
          Nip46SocketEvent.ResponseReceived,
          onFunction.bind(this)
        );
        reject("No response received within timeout.");
        return;
      }, timeoutInMs);

      const onFunction = (response: Nip46Response) => {
        if (response.id !== requestId) {
          return; // not a response to our request
        }

        if (response.error) {
          window.clearTimeout(timeoutId);
          this.events.off(
            Nip46SocketEvent.ResponseReceived,
            onFunction.bind(this)
          );
          reject(response.error);
          return;
        } else {
          window.clearTimeout(timeoutId);
          this.events.off(
            Nip46SocketEvent.ResponseReceived,
            onFunction.bind(this)
          );
          resolve(response.result);
          return;
        }
      };

      this.events.on(Nip46SocketEvent.ResponseReceived, onFunction.bind(this));
    });
  }

  getRelay(): string {
    return this._relay;
  }

  goOffline(): void {
    super.goOffline();
  }

  private _nip46OnOpen() {
    // Instruct relay to deliver NIP-46 relevant messages that are
    // addressed to this client.

    const filters: NostrFilters = {
      kinds: [24133], // NIP-46
      "#p": [this._clientPubkey],
      since: Math.floor(Date.now() / 1000) - 5,
    };
    this.sendReq(this._subscriptionId, filters);
  }

  private async _nip46OnMessage(event: NostrRelay2ClientMessage_EVENT) {
    const decryptedContent = await nip04.decrypt(
      this._clientPrivkey,
      event.event.pubkey,
      event.event.content
    );

    const decrypted = JSON.parse(decryptedContent);

    const nip46Message = new Nip46Message(event, decrypted);
    const nip46ResponseExt = nip46Message.getAsResponseExt();
    if (nip46ResponseExt) {
      this.events.emit(Nip46SocketEvent.ResponseReceived, nip46ResponseExt);
    } else {
      const nip46RequestExt = nip46Message.getAsRequestExt();
      if (nip46RequestExt) {
        this.events.emit(
          Nip46SocketEvent.RequestReceived,
          this,
          nip46RequestExt
        );
      }
    }
  }
}
