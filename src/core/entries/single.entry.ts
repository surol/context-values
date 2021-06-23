import { lazyValue } from '@proc7ts/primitives';
import { CxEntry } from '../entry';

/**
 * Creates single-valued context entry definer.
 *
 * Treats the last provided asset as entry value and ignores the rest of them.
 *
 * The entry value is evaluated at most once.
 *
 * @typeParam TValue - Context value type.
 * @param byDefault - Creates {@link CxEntry.Definition.getDefault default} entry value. Accepts entry definition target
 * as the only parameter.
 *
 * @returns New context entry definer.
 */
export function cxSingle<TValue>(
    {
      byDefault,
    }: {
      byDefault?(this: void, target: CxEntry.Target<TValue>): TValue | null | undefined;
    } = {},
): CxEntry.Definer<TValue> {
  return target => ({
    get: lazyValue(() => target.recentAsset),
    getDefault: byDefault && lazyValue(() => byDefault(target)),
  });
}