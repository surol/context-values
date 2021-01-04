import {
  AfterEvent,
  AfterEvent__symbol,
  mapAfter_,
  OnEvent,
  onEventBy,
  supplyAfter,
  trackValue,
  ValueTracker,
} from '@proc7ts/fun-events';
import { neverSupply, Supply, SupplyPeer, valueProvider } from '@proc7ts/primitives';
import type { ContextRequest } from '../context-ref';
import type { ContextRegistry } from '../context-registry';
import { ContextSupply } from '../context-supply';
import type { ContextValues } from '../context-values';
import type { ContextModule } from './context-module';
import { ContextModuleLoader } from './context-module-loader';

/**
 * @internal
 */
export class ContextModuleUsage {

  private readonly _impl: ValueTracker<ContextModule | undefined>;
  private readonly _rev: ValueTracker<ContextModuleRev>;
  private _useCounter = 0;

  private _setup!: () => void;

  constructor(context: ContextValues, readonly module: ContextModule) {
    this._impl = trackValue();
    this._rev = trackValue({
      status: {
        module: this.module,
        provided: false,
        used: false,
        settled: false,
        ready: false,
      },
      supply: neverSupply(),
    });

    const contextSupply = context.get(ContextSupply);

    contextSupply.cuts(this._impl);
    contextSupply.cuts(this._rev);

    this._impl.read(module => {

      const prevSupply = this._rev.it.supply;

      if (module) {
        this._load(module);
      }

      prevSupply.off();
    });
  }

  createHandle(): ContextModule.Handle {

    const read: AfterEvent<[ContextModule.Status]> = this._rev.read.do(
        mapAfter_(({ status }) => status),
    );

    const handle: ContextModule.Handle = {
      read,
      [AfterEvent__symbol]: valueProvider(read),
      use: (user?: SupplyPeer) => this._use(handle, user),
    };

    return handle;
  }

  setup(context: ContextValues, registry: ContextRegistry): void {

    const loader = context.get(ContextModuleLoader);

    this._setup = () => {

      const rev = this._rev.it;
      const { status: { module }, supply } = rev;

      if (module !== this.module) {
        // Load implementation module instead.
        // The implementation module expected to be provided already.
        context.get(module).use(supply).read({
          supply,
          receive: (_ctx, { settled, ready, error }) => {
            this._updateStatus(rev, settled, ready, error);
          },
        });
      } else {
        loadContextModule(context, registry, loader, rev)
            .then(({ whenReady }) => {
              this._updateStatus(rev, true, false);
              return whenReady;
            })
            .then(() => this._updateStatus(rev, true, true))
            .catch(error => rev.supply.off(error));
      }
    };
  }

  implementBy(impl: AfterEvent<[ContextModule?]>): void {
    this._impl.by(impl);
  }

  private _updateStatus(
      rev: ContextModuleRev,
      settled: boolean,
      ready: boolean,
      error?: unknown,
  ): void {
    // Ensure updating the correct revision.
    if (this._rev.it.supply !== rev.supply) {
      // If revision changed, then drop the obsolete one.
      rev.supply.off();
    } else {
      this._rev.it = rev = {
        status: {
          module: rev.status.module,
          provided: rev.status.provided,
          used: true,
          settled,
          ready,
          error,
        },
        supply: rev.supply,
      };
    }
  }

  private _load(module: ContextModule): void {

    const supply = new Supply().needs(this._rev).whenOff(error => {

      const rev = this._rev.it;

      if (rev.supply === supply) {
        this._rev.it = {
          status: {
            ...this._rev.it.status,
            provided: false,
            settled: false,
            ready: false,
            error,
          },
          supply,
        };
      }
    });

    const used = !!this._useCounter;

    this._rev.it = {
      status: {
        module,
        provided: true,
        used,
        settled: false,
        ready: false,
      },
      supply,
    };

    if (used) {
      this._setup();
    }
  }

  private _use(handle: ContextModule.Handle, user?: SupplyPeer): ContextModule.Use {

    const supply = user ? user.supply : new Supply();
    const read = handle.read.do(supplyAfter(supply));
    const use: ContextModule.Use = {
      ...handle,
      read,
      whenSettled: ContextModule$Use$when(read, isContextModuleSettled),
      whenReady: ContextModule$Use$when(read, isContextModuleReady),
      supply,
    };

    if (!supply.isOff) {
      supply.whenOff(error => {
        if (!--this._useCounter) {

          const rev = this._rev.it;

          this._rev.it = {
            status: {
              ...rev.status,
              used: false,
              settled: false,
              ready: false,
              error,
            },
            supply: new Supply().off(error),
          };

          rev.supply.off(error);
        }
      });

      if (!this._useCounter++) {
        // Mark the module used and set it up.

        const rev = this._rev.it;

        this._rev.it = {
          status: {
            ...rev.status,
            used: true,
          },
          supply: rev.supply,
        };

        this._setup();
      }
    }

    return use;
  }

}

/**
 * @internal
 */
interface ContextModuleRev {

  readonly status: ContextModule.Status;
  readonly supply: Supply;

}

/**
 * @internal
 */
async function loadContextModule(
    context: ContextValues,
    registry: ContextRegistry,
    loader: ContextModuleLoader,
    { status: { module }, supply }: ContextModuleRev,
): Promise<{ whenReady: Promise<unknown> }> {

  const result: { whenReady: Promise<unknown> } = { whenReady: Promise.resolve() };

  await loader.loadModule({

    module,
    supply,

    get(request: ContextRequest<any>) {
      return context.get(request);
    },

    provide(spec): Supply {
      return registry.provide(spec).needs(supply);
    },

    initBy(init: (this: void) => (void | PromiseLike<unknown>)) {
      result.whenReady = result.whenReady.then(init);
    },

  });

  return result;
}

function ContextModule$Use$when(
    status: AfterEvent<[ContextModule.Status]>,
    test: (status: ContextModule.Status) => boolean,
): OnEvent<[ContextModule.Status]> {
  return onEventBy(receiver => status({
    supply: receiver.supply,
    receive: (context, status) => {
      if (test(status)) {
        receiver.receive(context, status);
        receiver.supply.off();
      } else if (status.error) {
        receiver.supply.off(status.error);
      }
    },
  }));
}

function isContextModuleSettled({ settled }: ContextModule.Status): boolean {
  return settled;
}

function isContextModuleReady({ ready }: ContextModule.Status): boolean {
  return ready;
}
