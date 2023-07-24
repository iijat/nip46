import { NostrFilters } from "../nostr/typeDefs";
import { NostrRelay2ClientMessage } from "../nostr/nostrRelay2ClientMessage";
import { BaseSocket, BaseSocketEvent } from "./baseSocket";

export enum NostrSocketEvent {
  EVENT = "EVENT",
  EOSE = "EOSE",
  NOTICE = "NOTICE",
}

export class NostrSocket extends BaseSocket {
  constructor(relay: string) {
    super(relay);
    this.events.on(BaseSocketEvent.Message, this._nostrOnMessage.bind(this));
  }

  async sendEvent<Event>(signedEvent: Event) {
    await this.goOnline();

    this._send(JSON.stringify(["EVENT", signedEvent]));
    // TODO: Analyze OK response from relay
    // Not sure if every relay is sending such OK
  }

  async sendReq(subscriptionId: string, filters: NostrFilters) {
    await this.goOnline();
    this._send(JSON.stringify(["REQ", subscriptionId, filters]));
  }

  private _nostrOnMessage(event: WebSocketEventMap["message"]) {
    const message = new NostrRelay2ClientMessage(event);

    const messageEVENT = message.getAsEVENT();
    if (messageEVENT) {
      this.events.emit(NostrSocketEvent.EVENT, messageEVENT);
      return;
    }

    const messageEOSE = message.getAsEOSE();
    if (messageEOSE) {
      this.events.emit(NostrSocketEvent.EOSE, messageEOSE);
      return;
    }

    const messageNOTICE = message.getAsNOTICE();
    if (messageNOTICE) {
      this.events.emit(NostrSocketEvent.NOTICE, messageNOTICE);
    }
  }
}
