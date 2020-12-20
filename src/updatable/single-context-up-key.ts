/**
 * @packageDocumentation
 * @module @proc7ts/context-values/updatable
 */
import { AfterEvent, afterEventBy, afterThe, digAfter, EventKeeper, supplyAfter } from '@proc7ts/fun-events';
import { noop } from '@proc7ts/primitives';
import type { ContextKeyDefault, ContextValueSlot } from '../context-key';
import { ContextKeyError } from '../context-key-error';
import { ContextSupply } from '../context-supply';
import { ContextUpKey, ContextUpRef } from './context-up-key';

/**
 * Single updatable context value reference.
 *
 * @typeParam TValue  Context value type.
 */
export type SingleContextUpRef<TValue> = ContextUpRef<AfterEvent<[TValue]>, TValue>;

/**
 * Single updatable context value key.
 *
 * The associated value is an `AfterEvent` keeper of the last source value. It is always present,
 * but signals an [[ContextKeyError]] error on attempt to receive an absent value.
 *
 * It is an error to provide a `null` or `undefined` {@link ContextRequest.Opts.or fallback value} when requesting
 * an associated value. Use an `afterThe()` result as a fallback instead.
 *
 * @typeParam TValue  Context value type.
 */
export class SingleContextUpKey<TValue>
    extends ContextUpKey<AfterEvent<[TValue]>, TValue>
    implements SingleContextUpRef<TValue> {

  /**
   * A provider of context value used when there is no value associated with this key.
   */
  readonly byDefault: ContextKeyDefault<TValue, ContextUpKey<AfterEvent<[TValue]>, TValue>>;

  get upKey(): this {
    return this;
  }

  /**
   * Constructs single updatable context value key.
   *
   * @param name - Human-readable key name.
   * @param seedKey - Value seed key. A new one will be constructed when omitted.
   * @param byDefault - Optional default value provider. If unspecified or `undefined` the key has no default
   * value.
   */
  constructor(
      name: string,
      {
        seedKey,
        byDefault = noop,
      }: {
        seedKey?: ContextUpKey.SeedKey<TValue>;
        byDefault?: ContextKeyDefault<TValue, ContextUpKey<AfterEvent<[TValue]>, TValue>>;
      } = {},
  ) {
    super(name, seedKey);
    this.byDefault = byDefault;
  }

  grow(
      slot: ContextValueSlot<AfterEvent<[TValue]>, EventKeeper<TValue[]> | TValue, AfterEvent<TValue[]>>,
  ): void {

    const value = slot.seed.do(digAfter((...sources: TValue[]): AfterEvent<TValue[]> => {
      if (sources.length) {
        // Sources present. Take the last one.
        return afterThe(sources[sources.length - 1]);
      }

      // Sources absent. Attempt to detect a backup value.
      let backup: AfterEvent<[TValue]> | null | undefined;

      if (slot.hasFallback) {
        backup = slot.or;
      } else {

        const defaultValue = this.byDefault(slot.context, this);

        backup = defaultValue && afterThe(defaultValue);
      }
      if (backup != null) {
        return backup; // Backup value found.
      }

      // Backup value is absent. Construct an error response.
      return afterEventBy<[TValue]>(() => {
        throw new ContextKeyError(this);
      });
    }));

    const supply = slot.context.get(ContextSupply, { or: null });

    slot.insert(supply ? value.do<AfterEvent<TValue[]>>(supplyAfter(supply)) : value);
  }

}

