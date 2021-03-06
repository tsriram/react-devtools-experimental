// @flow

import EventEmitter from 'events';

import type { Wall } from './types';

const BATCH_DURATION = 100;

type Message = {|
  event: string,
  payload: any,
|};

export default class Bridge extends EventEmitter {
  _messageQueue: Array<any> = [];
  _timeoutID: TimeoutID | null = null;
  _wall: Wall;

  constructor(wall: Wall) {
    super();

    this._wall = wall;

    wall.listen((message: Message) => {
      this.emit(message.event, message.payload);
    });
  }

  send(event: string, payload: any, transferable?: Array<any>) {
    // When we receive a message:
    // - we add it to our queue of messages to be sent
    // - if there hasn't been a message recently, we set a timer for 0 ms in
    //   the future, allowing all messages created in the same tick to be sent
    //   together
    // - if there *has* been a message flushed in the last BATCH_DURATION ms
    //   (or we're waiting for our setTimeout-0 to fire), then _timeoutID will
    //   be set, and we'll simply add to the queue and wait for that

    this._messageQueue.push(event, payload, transferable);
    if (!this._timeoutID) {
      this._timeoutID = setTimeout(this._flush, 0);
    }
  }

  _flush = () => {
    clearTimeout(this._timeoutID);
    this._timeoutID = null;

    if (this._messageQueue.length) {
      for (let i = 0; i < this._messageQueue.length; i += 3) {
        this._wall.send(
          this._messageQueue[i],
          this._messageQueue[i + 1],
          this._messageQueue[i + 2],
        );
      }
      this._messageQueue.length = 0;

      // Check again for queued messages in BATCH_DURATION ms. This will keep
      // flushing in a loop as long as messages continue to be added. Once no
      // more are, the timer expires.
      this._timeoutID = setTimeout(this._flush, BATCH_DURATION);
    }
  };
}
