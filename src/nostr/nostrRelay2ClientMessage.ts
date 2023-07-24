import { Event } from "nostr-tools";

export class NostrRelay2ClientMessage {
  readonly message: MessageEvent;
  readonly data: any[];

  constructor(message: MessageEvent) {
    this.message = message;

    if (!Array.isArray(JSON.parse(message.data))) {
      throw new Error("Websocket data could not be parsed into JSON.");
    }

    this.data = JSON.parse(message.data) as any[];
  }

  getAsEVENT(): NostrRelay2ClientMessage_EVENT | undefined {
    if (this.data[0] === "EVENT" && this.data.length === 3) {
      return new NostrRelay2ClientMessage_EVENT(this);
    }

    return undefined;
  }

  getAsEOSE(): NostrRelay2ClientMessage_EOSE | undefined {
    if (this.data[0] === "EOSE" && this.data.length === 2) {
      return new NostrRelay2ClientMessage_EOSE(this);
    }

    return undefined;
  }

  getAsNOTICE(): NostrRelay2ClientMessage_NOTICE | undefined {
    if (this.data[0] === "NOTICE" && this.data.length === 2) {
      return new NostrRelay2ClientMessage_NOTICE(this);
    }

    return undefined;
  }
}

export class NostrRelay2ClientMessage_EVENT {
  readonly nostrRelay2ClientMessage: NostrRelay2ClientMessage;
  readonly subscriptionId: string;
  readonly event: Event;

  constructor(nostrRelay2ClientMessage: NostrRelay2ClientMessage) {
    this.nostrRelay2ClientMessage = nostrRelay2ClientMessage;
    this.subscriptionId = this.nostrRelay2ClientMessage.data[1];
    this.event = nostrRelay2ClientMessage.data[2];
  }
}

export class NostrRelay2ClientMessage_EOSE {
  readonly nostrRelay2ClientMessage: NostrRelay2ClientMessage;

  constructor(nostrRelay2ClientMessage: NostrRelay2ClientMessage) {
    this.nostrRelay2ClientMessage = nostrRelay2ClientMessage;
  }
}

export class NostrRelay2ClientMessage_NOTICE {
  readonly nostrRelay2ClientMessage: NostrRelay2ClientMessage;

  constructor(nostrRelay2ClientMessage: NostrRelay2ClientMessage) {
    this.nostrRelay2ClientMessage = nostrRelay2ClientMessage;
  }
}
