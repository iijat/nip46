export type NostrFilters = {
  /** A list of event ids or prefixes */
  ids?: string[];

  /** A list of pubkeys or prefixes, the pubkey of an event must be one of these */
  authors?: string[];

  /** A list of a kind numbers */
  kinds?: number[];

  /** A list of event ids that are referenced in an "e" tag  */
  "#e"?: string[];

  /** A list of pubkeys that are referenced in a "p" tag  */
  "#p"?: string[];

  /** An integer unix timestamp, events must be newer than this to pass */
  since?: number;

  /** An integer unix timestamp, events must be older than this to pass */
  until?: number;

  /** Maximum number of events to be returned in the initial query */
  limit?: number;
};
