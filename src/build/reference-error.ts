import { CxEntry } from '../core';

/**
 * Represents an error when non-existent context value referenced. I.e. when requested context entry has no value.
 */
export class CxReferenceError extends ReferenceError {

  /**
   * Illegally referred context entry.
   */
  readonly entry: CxEntry<any>;

  /**
   * Original error reason.
   */
  readonly reason: unknown;

  /**
   * Constructs context context reference error.
   *
   * @param entry - Illegally referred context entry.
   * @param message - Arbitrary error message.
   * @param reason - Original error reason.
   */
  constructor(entry: CxEntry<any>, message = `The ${String(entry)} has no value`, reason?: unknown) {
    super(message);
    this.entry = entry;
    this.reason = reason;
  }

}