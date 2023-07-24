import { nip19 } from "nostr-tools";
import { v4 } from "uuid";

export interface Nip46UriMetadata {
  name: string;
  url?: string;
  description?: string;
  icons?: string[];
}

export class Nip46Uri {
  id = v4();
  pubkey: string;
  relay: string;
  metadata: Nip46UriMetadata;

  constructor({
    pubkey,
    relay,
    metadata,
  }: {
    pubkey: string;
    relay: string;
    metadata: Nip46UriMetadata;
  }) {
    this.pubkey = pubkey;
    this.relay = relay;
    this.metadata = metadata;
  }

  toURI(): string {
    return (
      `nostrconnect://${this.pubkey}?relay=` +
      `${encodeURIComponent(this.relay)}&metadata=` +
      `${encodeURIComponent(JSON.stringify(this.metadata))}`
    );
  }

  static fromURI(uri: string): Nip46Uri {
    const errorPrefix = "Invalid nostr connect uri: ";

    const url = new URL(uri);
    if (url.protocol.toLowerCase() !== "nostrconnect:") {
      throw new Error(errorPrefix + "wrong protocol");
    }

    const pubkey = url.hostname.toLowerCase() || url.pathname.substring(2);
    if (!pubkey) {
      throw new Error(errorPrefix + "missing pubkey");
    }

    try {
      nip19.npubEncode(pubkey);
    } catch (error) {
      throw new Error(errorPrefix + "pubkey check failed");
    }

    //const target = url.hostname || url.pathname.substring(2);

    const relay = url.searchParams.get("relay");
    if (!relay) {
      throw new Error(errorPrefix + "missing relay");
    }

    const regExp = /^wss:\/\/[A-Z0-9.-]+\.[A-Z]{2,}$/i;
    if (!regExp.test(relay)) {
      throw new Error(errorPrefix + "relay check failed");
    }

    const metadataString = url.searchParams.get("metadata");
    if (!metadataString) {
      throw new Error(errorPrefix + "missing metadata");
    }

    let metadata: Nip46UriMetadata | undefined;
    try {
      metadata = JSON.parse(metadataString) as Nip46UriMetadata;
    } catch (error) {
      throw new Error(errorPrefix + "metadata is not a valid JSON");
    }

    if (typeof metadata.name === "undefined") {
      throw new Error(
        errorPrefix + "metadata does not include mandatory field 'name'"
      );
    }

    return new Nip46Uri({ pubkey, metadata, relay });
  }
}
