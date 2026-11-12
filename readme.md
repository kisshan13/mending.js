# Mending.js

**A lightweight execution runtime for dynamically composed, agentic systems.**

Mending.js provides primitives for running registered functions, spawning child executions, pausing for external input, and propagating results back to callers. It manages execution frames and callable-specific state so applications can build their own workflows, agents, and delegation logic on top.

Mending.js is **not** an agent framework. It does not implement model calls, planning, scheduling, or agent decision-making.

> **Status: Under development.** Mending.js has not been published to npm. Its API, persistence format, and execution behavior are experimental and may change without notice.

## Installation

There is no published npm package yet. Build the project locally and import from its generated `dist` directory. The examples below assume imports from `./dist/index.js`; adjust the relative path for your project.

## Quick start

Create a callable, provide a registry to the runtime, set an entrypoint, and execute it.

```typescript
import { Callable, CallableRegistry, Runtime } from './dist/index.js'

const greeting = new Callable('greeting', async ({ data, complete }) => {
	return complete({ message: `Hello, ${data.name}!` })
})

const registry = new CallableRegistry()
const runtime = new Runtime({ registry })

runtime.setDefault(greeting)

const result = await runtime.execute({ name: 'World' })

console.log(result.type) // 'completed'
console.log(result.data) // { message: 'Hello, World!' }
```

**Important:** `Runtime` requires an options object containing a `CallableRegistry`. The older `new Runtime()` initialization is not supported by the current implementation.

`setDefault()` selects the entrypoint and registers that callable automatically. Other callables must be registered before they can be spawned.

## Core concepts

### Runtime

`Runtime` executes the entrypoint, tracks execution frames, dispatches spawned callables, suspends a waiting frame, and returns a result to the application. It is initialized with a registry and optionally an existing `RuntimeState`.

### Callable

A `Callable` represents one executable unit. It has a unique string identifier, an asynchronous execution function, and an optional initial state object.

```typescript
const task = new Callable('task', async (ctx) => ctx.complete(ctx.data), {
	attempts: 0,
})
```

Each invocation receives a `CallableContext`:

| Member                  | Purpose                                                   |
| ----------------------- | --------------------------------------------------------- |
| `data`                  | Input for this invocation.                                |
| `state`                 | State associated with the callable's identifier.          |
| `complete(data)`        | Complete the callable and return a result.                |
| `spawn(data, callable)` | Ask the runtime to execute a registered child callable.   |
| `wait(data)`            | Suspend execution and return a result to the application. |

The callable must return one of these results. Calling a helper constructs a result; it does not itself change the runtime's control flow until the callable **returns** that result.

### CallableRegistry

The `CallableRegistry` maps identifiers to callable implementations. A runtime uses the registry to resolve spawn requests and to reconstruct frame references when loading serialized state.

```typescript
const registry = new CallableRegistry()
registry.add(worker, coordinator)

const runtime = new Runtime({ registry })
runtime.setDefault(coordinator)
```

The registry accepts multiple callables with `add(...callables)`. It exposes `get(identifier)`, `all()`, `remove(callable)`, and add/remove event subscriptions via `on(event, callback)`. Adding an identifier that already exists does not replace its registered callable.

### Frames and state

A `Frame` represents one callable invocation, including its callable, input parameters, and generated frame identifier. The runtime maintains stacks of frames while it processes spawn and completion results.

A `CallableState` is separate from a frame: it is keyed by the **callable identifier**. Repeated invocations of the same callable in one runtime state share that callable's state. It is not a separate state object for each spawned frame.

## Execution results

A callable can return three result types:

| Type        | Meaning                                                            |
| ----------- | ------------------------------------------------------------------ |
| `completed` | The current callable has finished.                                 |
| `spawn`     | Execute a registered child callable with the supplied data.        |
| `wait`      | Suspend the current callable and yield control to the application. |

For valid spawn requests, the runtime ordinarily handles `spawn` internally. The caller of `runtime.execute()` typically receives a `completed` or `wait` frame result.

### Completion

```typescript
const double = new Callable('double', async ({ data, complete }) => {
	return complete({ value: data.value * 2 })
})
```

If a child callable completes, its completion data replaces the parent frame's input and the runtime invokes the parent callable again. This is **re-execution of the parent function**, not continuation from the exact JavaScript instruction where `spawn()` was called.

### Spawning another callable

```typescript
import { Callable, CallableRegistry, Runtime } from './dist/index.js'

const worker = new Callable('worker', async ({ data, complete }) => {
	return complete({ doubled: data.value * 2 })
})

const coordinator = new Callable(
	'coordinator',
	async ({ data, state, spawn, complete }) => {
		if (!state.get('workerStarted')) {
			state.set('workerStarted', () => true)
			return spawn({ value: data.value }, worker)
		}

		return complete({ workerResult: data })
	},
	{ workerStarted: false }
)

const registry = new CallableRegistry()
const runtime = new Runtime({ registry })

runtime.register(worker)
runtime.setDefault(coordinator)

const result = await runtime.execute({ value: 21 })
console.log(result.data) // { workerResult: { doubled: 42 } }
```

The parent uses callable state to remember that it already spawned the child. Without that guard, the parent could spawn the same child again when it is re-invoked with the child's result.

`spawn(data, callable)` uses the callable's identifier. The callable must be available in the registry; passing an unregistered object does not register it automatically.

### Waiting for external input

```typescript
import { Callable, CallableRegistry, Runtime } from './dist/index.js'

const approval = new Callable(
	'approval',
	async ({ data, state, wait, complete }) => {
		if (data.approved !== true) {
			state.set('originalRequest', () => data)
			return wait({ reason: 'approval_required', amount: data.amount })
		}

		const originalRequest = state.get('originalRequest')
		return complete({ approved: true, amount: originalRequest.amount })
	}
)

const registry = new CallableRegistry()
const runtime = new Runtime({ registry })
runtime.setDefault(approval)

const pending = await runtime.execute({ amount: 500, approved: false })
console.log(pending.type) // 'wait'

// Resume using the SAME runtime instance.
const finished = await runtime.execute({ approved: true })
console.log(finished.data) // { approved: true, amount: 500 }
```

When a callable returns `wait`, the runtime retains one waiting frame in memory. The next call to `execute(input)` updates that frame's input and invokes the callable again.

**Resumption replaces the prior frame input; it does not merge objects.** Store any data needed after resumption in `CallableState` (or send it again). JavaScript local variables and the original function call stack are not preserved.

The implementation maintains **one waiting frame per runtime instance**. A nested callable can wait, and a later callable can wait after the first is resumed, but simultaneous independent waiting frames are not supported.

## Callable state

State is provided through the callable execution context.

```typescript
const count = state.get('count')

state.set('count', (current) => (current ?? 0) + 1)
```

`state.set(key, updater)` takes a callback; it does not accept a direct replacement value. The callback receives the current value and returns the new value.

Provide initial state as the third argument to `new Callable(identifier, execute, baseState?)`:

```typescript
const counter = new Callable(
	'counter',
	async ({ state, complete }) => {
		state.set('count', (current) => current + 1)
		return complete({ count: state.get('count') })
	},
	{ count: 0 }
)
```

Values should be serializable if you intend to use `persist()` and JSON storage.

## Persistence and loading

The current source includes a serialization API for the runtime, frame stacks, and callable state:

- `runtime.persist()` produces a structured snapshot (currently labeled schema `0.0.1`).
- `Runtime.load({ registry, data })` constructs a runtime from a snapshot.
- `Frame`, `RuntimeState`, and `CallableState` also expose `persist()` and `load()` methods.

Serialized snapshots store **callable identifiers**, not executable functions. Re-register the corresponding callables before loading.

```typescript
import { Callable, CallableRegistry, Runtime } from './dist/index.js'

const job = new Callable('job', async ({ data, complete }) => {
	return complete({ value: data.value * 2 })
})

const registry = new CallableRegistry()
registry.add(job)

const runtime = new Runtime({ registry })
runtime.setDefault(job)

// Serialize a configured runtime before execution.
const serialized = JSON.stringify(runtime.persist())

// In a new process, recreate the registry and its callables first.
// Here we reuse the registry only to keep the example short.
const restored = Runtime.load({
	registry,
	data: JSON.parse(serialized),
})

const result = await restored.execute({ value: 21 })
console.log(result.data) // { value: 42 }
```

You must store and retrieve the serialized value yourself. Mending.js does not currently provide a database adapter, automatic checkpointing, or restart-safe execution guarantees.

**Critical restriction:** `RuntimeState.persist()` does **not** serialize its `waiting` field. Consequently, a snapshot made while a callable is waiting cannot currently restore that waiting frame. Treat persistence as an experimental serialization facility, **not** reliable suspend-and-resume durability across process restarts.

See the [examples](./examples/README.md) for basic execution, spawning, multiple suspension points, and snapshot loading.

## API reference

### `Runtime`

| API                                   | Behavior                                                       |
| ------------------------------------- | -------------------------------------------------------------- |
| `new Runtime({ registry, state? })`   | Create a runtime. `registry` is required; `state` is optional. |
| `setDefault(callable)`                | Set and register the entrypoint.                               |
| `register(callable)`                  | Register an additional callable.                               |
| `execute(data): Promise<FrameResult>` | Start or continue execution.                                   |
| `persist()`                           | Return a serializable runtime snapshot.                        |
| `Runtime.load({ registry, data })`    | Load a snapshot using a callable registry.                     |
| `getStatus()`                         | Return a promise with the current status value.                |
| `shutdown()`                          | Call the runtime state's registry-listener cleanup.            |

`RuntimeOpts` is `{ registry: CallableRegistry; state?: RuntimeState }`. `ExecutionParams` is currently typed as `any`. `Status` is declared as `'idle' | 'running'`, but the supplied implementation does not update `status` during execution; do not use `getStatus()` as a dependable activity signal yet.

### `Callable`

| API                                             | Behavior                                            |
| ----------------------------------------------- | --------------------------------------------------- |
| `new Callable(identifier, execute, baseState?)` | Construct an executable unit.                       |
| `getIdentifier()`                               | Return the identifier.                              |
| `getBaseState()`                                | Return the optional initial state.                  |
| `call(data, state)`                             | Invoke the execution function with context helpers. |
| `Callable.complete(data)`                       | Construct a completion result.                      |
| `Callable.spawn(data, callable)`                | Construct a spawn result.                           |
| `Callable.wait(data)`                           | Construct a wait result.                            |

### `FrameResult`

The runtime returns the following shape:

```typescript
interface FrameResult {
	type: 'wait' | 'spawn' | 'completed'
	frameId: string
	data: any
	spawnIdentifier: string
}
```

`frameId` identifies the frame that returned the result. `spawnIdentifier` is the target callable identifier for a spawn result; the current `Frame.call()` implementation sets it to an empty string for other result types.

The result returned directly by a callable differs slightly:

```typescript
interface CallableResult {
	type: 'wait' | 'spawn' | 'completed'
	data: any
	spawnIdentifier?: string
}
```

### Exported types and errors

The package entrypoint also exports `CallableContext`, `CallableFn`, `CallableState`, `CallableStateUpdate`, `RuntimeState`, `Frame`, `Persistency`, `ICallable`, `FrameResultType`, `CallableResultType`, `RuntimeOpts`, `ExecutionParams`, `Status`, and these error classes:

- `RuntimeError`, `RuntimeEntrypointError`, `RuntimeFrameError`
- `RuntimeCallableNotFound`, `FrameMissingSpawnId`, `RuntimePersistError`

`RuntimeEntrypointError` is used for a missing entrypoint; `RuntimeCallableNotFound` is used when a spawn identifier cannot be resolved; persistence-loading errors use `RuntimePersistError`.

## Building agentic systems

The execution model supports dynamic delegation with nested callables:

```text
Main Agent
  └── Research Agent
       ├── Web Agent
       │    └── WAIT: Approval required
       └── Analysis Agent
            └── WAIT: Additional input required
```

Each callable decides whether to complete, spawn, or wait. Mending.js handles dispatch and result propagation; the application supplies the logic for decisions, permissions, tool use, scheduling, and retries.

## Current limitations and implementation caveats

- **Experimental API:** No npm release or compatibility guarantees.
- **No persistent storage integration:** You must save snapshots yourself; there is no automatic checkpointing.
- **Waiting frames are not serialized:** Paused execution cannot reliably be restored through `Runtime.load()`.
- **Single waiting frame:** Only one `waiting` slot exists per runtime state.
- **No distributed execution, retries, or scheduling:** These concerns belong to the application.
- **Callable state is shared per identifier:** Concurrent or repeated logical invocations of the same callable do not get isolated state automatically.
- **Frame-stack issue:** The current `RuntimeState.push(frame, 'execute')` also pushes the frame onto the normal stack. This can leave extra frames and makes repeated execution and snapshot recovery unreliable until corrected.
- **Registry-listener cleanup issue:** `CallableRegistry.on()` stores listeners under an event-suffixed key, but its returned disposer deletes the unsuffixed ID. This affects cleanup through `shutdown()`.
- **Status reporting is incomplete:** `getStatus()` currently does not reflect active execution.

See [Examples](./example.md) for runnable patterns that match the current constructor and API surface.

## Development status

Mending.js is actively evolving. Interfaces and runtime behavior may change without notice; there is no published stability roadmap. Feedback, experiments, and contributions are welcome.
