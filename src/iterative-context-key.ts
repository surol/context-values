/**
 * @packageDocumentation
 * @module @proc7ts/context-values
 */
import { AIterable, itsEmpty, overArray, overNone } from '@proc7ts/a-iterable';
import { asis, isPresent } from '@proc7ts/call-thru';
import { ContextKey, ContextSeedKey } from './context-key';
import { ContextSeeder } from './context-seeder';
import { ContextValueProvider } from './context-value-spec';
import { ContextValues } from './context-values';

/**
 * @internal
 */
class IterativeContextSeeder<Ctx extends ContextValues, Src> implements ContextSeeder<Ctx, Src, AIterable<Src>> {

  private readonly _providers: ContextValueProvider<Ctx, Src>[] = [];

  provide(provider: ContextValueProvider<Ctx, Src>): () => void {
    this._providers.push(provider);
    return () => {

      const found = this._providers.indexOf(provider);

      if (found >= 0) {
        this._providers.splice(found, 1);
      }
    };
  }

  seed(context: Ctx, initial: AIterable<Src> = AIterable.from(overNone())): AIterable<Src> {
    return AIterable.from([
      initial,
      iterativeSeed(context, this._providers),
    ]).flatMap(asis);
  }

  isEmpty(seed: AIterable<Src>): boolean {
    return itsEmpty(seed);
  }

  combine(first: AIterable<Src>, second: AIterable<Src>): AIterable<Src> {
    return AIterable.from([first, second]).flatMap(asis);
  }

}

/**
 * @internal
 */
class IterativeSeedKey<Src> extends ContextSeedKey<Src, AIterable<Src>> {

  seeder<Ctx extends ContextValues>(): IterativeContextSeeder<Ctx, Src> {
    return new IterativeContextSeeder();
  }

}

/**
 * Iterative context value key implementation.
 *
 * Collects value sources as iterable instance.
 *
 * A context value associated with this key is never changes once constructed.
 *
 * @typeparam Value  Context value type.
 * @typeparam Src  Source value type.
 */
export abstract class IterativeContextKey<Value, Src = Value> extends ContextKey<Value, Src, AIterable<Src>> {

  readonly seedKey: ContextSeedKey<Src, AIterable<Src>>;

  /**
   * Constructs iterative context value key.
   *
   * @param name  Human-readable key name.
   * @param seedKey  Value seed key. A new one will be constructed when omitted.
   */
  constructor(name: string, seedKey?: ContextSeedKey<Src, AIterable<Src>>) {
    super(name);
    this.seedKey = seedKey || new IterativeSeedKey(this);
  }

}

/**
 * Context value provider and cached context value source.
 *
 * @internal
 */
type SourceEntry<Ctx extends ContextValues, Src> = [ContextValueProvider<Ctx, Src>, (Src | null | undefined)?];

/**
 * @internal
 */
function iterativeSeed<Ctx extends ContextValues, Src>(
    context: Ctx,
    providers: readonly ContextValueProvider<Ctx, Src>[],
): AIterable<Src> {
  return AIterable.from(overArray(providers.map<SourceEntry<Ctx, Src>>(provider => [provider])))
      .map(entry => {
        if (entry.length > 1) {
          return entry[1];
        }

        const source = entry[0](context);

        entry.push(source);

        return source;
      })
      .filter<Src>(isPresent);
}
