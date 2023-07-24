import { EventEmitter } from "events";

export enum BaseSocketEvent {
  Message = "message",
  Open = "open",
  Error = "error",
  Close = "close",
}

export abstract class BaseSocket {
  // #region Public Properties

  readonly events = new EventEmitter();

  // #endregion Public Properties

  // #region Private Properties

  private _ws: WebSocket | undefined;
  private _isWsOn = false;

  // #endregion Private Properties

  constructor(protected _relay: string) {}

  /**
   * Opens a websocket connection if it is not already open.
   *
   * Throws an exception if the connection could not be established
   * in time or if an error occurred.
   * @param timeoutInSeconds (defaults to 15)
   */
  goOnline(timeoutInSeconds: number | undefined = 15): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this._ws?.readyState === WebSocket.OPEN) {
        resolve(); // healthy and online
        return;
      }

      if (this._ws) {
        this._wsOff();
        this._ws.close();
        this._ws = undefined;
      }

      const openTimeout = window.setTimeout(() => {
        this.events.off(BaseSocketEvent.Open, open.bind(this));
        this.events.off(BaseSocketEvent.Error, error.bind(this));
        reject("Websocket connection timeout.");
      }, timeoutInSeconds * 1000);

      const open = (event: Event) => {
        window.clearTimeout(openTimeout);
        this.events.off(BaseSocketEvent.Open, open.bind(this));
        this.events.off(BaseSocketEvent.Error, error.bind(this));
        resolve();
        return;
      };

      const error = (event: Event) => {
        window.clearTimeout(openTimeout);
        this.events.off(BaseSocketEvent.Open, open.bind(this));
        this.events.off(BaseSocketEvent.Error, error.bind(this));
        reject(JSON.stringify(event));
        return;
      };

      this._ws = new WebSocket(this._relay);
      this._wsOn();

      this.events.on(BaseSocketEvent.Open, open.bind(this));
      this.events.on(BaseSocketEvent.Error, error.bind(this));
    });
  }

  goOffline() {
    if (!this._ws) {
      return;
    }

    this._ws.close(1000, "User is closing the connection.");
    this._wsOff();
    this._ws = undefined;
  }

  protected _send(text: string) {
    this._ws?.send(text);
  }

  private _wsOn() {
    if (this._isWsOn) {
      return;
    }

    this._ws?.addEventListener("open", this._onOpen.bind(this));
    this._ws?.addEventListener("message", this._onMessage.bind(this));
    this._ws?.addEventListener("close", this._onClose.bind(this));
    this._ws?.addEventListener("error", this._onError.bind(this));

    this._isWsOn = true;
  }

  private _wsOff() {
    if (!this._isWsOn) {
      return;
    }

    this._ws?.removeEventListener("open", this._onOpen.bind(this));
    this._ws?.removeEventListener("message", this._onMessage.bind(this));
    this._ws?.removeEventListener("close", this._onClose.bind(this));
    this._ws?.removeEventListener("error", this._onError.bind(this));

    this._isWsOn = false;
  }

  private _onOpen(event: WebSocketEventMap["open"]) {
    this.events.emit(BaseSocketEvent.Open, event);
  }

  private _onMessage(event: WebSocketEventMap["message"]) {
    this.events.emit(BaseSocketEvent.Message, event);
  }

  private _onClose(event: WebSocketEventMap["close"]) {
    this.events.emit(BaseSocketEvent.Close, event);
  }

  private _onError(event: WebSocketEventMap["error"]) {
    this.events.emit(BaseSocketEvent.Error, event);
  }
}
