# Mending.js

**A lightweight execution runtime for building agentic systems.**

Mending.js is an execution runtime designed to manage dynamically composed function executions. It provides primitives for executing callables, spawning other callables, suspending execution, and resuming it with external input.

Mending.js is intended to serve as a foundation for building agentic systems. It does not implement agent orchestration, planning, or decision-making. Instead, it provides the execution primitives that higher-level systems can build upon.

> **Status: Under Development**
>
> Mending.js is currently under active development and has not yet been published to the npm registry. Its APIs and interfaces are experimental and may change without notice, including breaking changes. There is currently no defined roadmap or commitment to API stability.

## Core Concepts

Mending.js currently exposes two primary abstractions.

### Runtime

The `Runtime` manages the execution lifecycle. It maintains execution state, resolves callable invocations, manages spawned executions, and handles suspension and completion.

### Callable

A `Callable` represents an executable unit registered with the runtime.

A callable receives an execution context containing:

- `data`: Input data for the current invocation.
- `state`: State associated with the callable.
- `spawn`: Request execution of another callable.
- `wait`: Suspend the current execution.
- `complete`: Mark the current execution as completed.

Callables do not need to know how the runtime manages execution internally. They only need to return an execution result using the provided context.

## Installation

Mending.js has not yet been published to the npm registry.

For now, the project can only be explored and used through its source code or local build.

## Getting Started

### 1. Import the runtime

The package currently exports `Runtime` and `Callable` from its entrypoint.

```typescript
import { Runtime, Callable } from './dist/index.js'
```

### 2. Create a callable

A callable is initialized with an identifier and an asynchronous execution function.

```typescript
const greeting = new Callable('greeting', async ({ data, complete }) => {
	return complete({
		message: `Hello, ${data.name}!`,
	})
})
```

The execution function receives a context object containing the input data and runtime execution helpers.

### 3. Initialize the runtime

Create a runtime instance and register your callable.

```typescript
const runtime = new Runtime()

runtime.setDefault(greeting)
```

`setDefault()` defines the entrypoint callable for the runtime. The entrypoint is also registered automatically.

Additional callables can be registered using `register()`.

```typescript
runtime.register(greeting)
```

### 4. Execute

Start execution by passing the initial input to `execute()`.

```typescript
const result = await runtime.execute({
	name: 'World',
})

console.log(result)
```

The runtime executes the entrypoint and returns a `FrameResult`.

## Callable Execution

A callable can produce three types of execution results.

| Result      | Description                                                                |
| ----------- | -------------------------------------------------------------------------- |
| `completed` | Marks the current callable execution as completed.                         |
| `spawn`     | Requests the runtime to execute another registered callable.               |
| `wait`      | Suspends the current callable execution and returns control to the caller. |

These results are created using the execution context provided to each callable.

### Completing execution

Use `complete()` when a callable has finished its execution.

```typescript
const task = new Callable('task', async ({ data, complete }) => {
	const result = data.value * 2

	return complete(result)
})
```

The returned data is propagated to the parent callable when the current callable was spawned by another callable.

### Spawning another callable

A callable can request the runtime to execute another callable using `spawn()`.

```typescript
const worker = new Callable('worker', async ({ data, complete }) => {
	return complete({
		result: data.value * 2,
	})
})

const orchestrator = new Callable('orchestrator', async ({ data, spawn }) => {
	return spawn({ value: data.value }, worker)
})
```

Register the worker and configure the orchestrator as the entrypoint.

```typescript
const runtime = new Runtime()

runtime.register(worker)
runtime.setDefault(orchestrator)

const result = await runtime.execute({
	value: 21,
})
```

When the worker completes, its result is passed back to the parent callable as its updated input.

The parent callable is invoked again with that result, allowing it to continue its execution logic.

Callables referenced through `spawn()` must be registered with the runtime.

### Waiting for external input

A callable can suspend its execution when it requires external input.

Use `wait()` to return control to the application.

```typescript
const approval = new Callable(
	'approval',
	async ({ data, wait, complete, state }) => {
		if (!data.approved) {
			state.set('request', () => data)

			return wait({
				reason: 'approval_required',
				amount: data.amount,
			})
		}

		const request = state.get('request')

		return complete({
			approved: true,
			amount: request.amount,
		})
	}
)
```

When a callable returns `wait`, the runtime retains the waiting frame in its current runtime state and returns the waiting result to the caller.

The application can then obtain the required input and call `execute()` again on the same runtime instance.

```typescript
const runtime = new Runtime()

runtime.setDefault(approval)

const firstResult = await runtime.execute({
	amount: 500,
	approved: false,
})

console.log(firstResult)

// Provide the required external input.
const resumedResult = await runtime.execute({
	approved: true,
})

console.log(resumedResult)
```

The runtime re-invokes the suspended callable with the newly provided input.

**Note:** This is runtime-managed re-execution, not restoration of the original JavaScript instruction pointer or local variables. Use `CallableState` to retain data across callable invocations.

The current implementation supports one waiting frame per runtime instance.

## Callable State

Each callable can maintain its own state through the `state` object provided in its execution context.

State is associated with the callable identifier and shared across its invocations within the same runtime state.

### Reading state

```typescript
const value = state.get('counter')
```

### Updating state

State updates use a callback that receives the current value.

```typescript
state.set('counter', (current) => {
	return (current ?? 0) + 1
})
```

### Initial state

A callable can also define an initial state through its constructor.

```typescript
const counter = new Callable(
	'counter',
	async ({ state, complete }) => {
		state.set('count', (current) => {
			return (current ?? 0) + 1
		})

		return complete({
			count: state.get('count'),
		})
	},
	{
		count: 0,
	}
)
```

The initial state is used when the runtime first initializes state for that callable.

## Runtime API

### `new Runtime(opts?)`

Creates a new runtime instance.

```typescript
const runtime = new Runtime()
```

An optional `RuntimeState` can be supplied through the constructor.

### `runtime.setDefault(callable)`

Defines the default entrypoint callable.

The entrypoint is automatically registered with the runtime.

### `runtime.register(callable)`

Registers a callable using its identifier.

Registered callables can be referenced by other callables through `spawn()`.

### `runtime.execute(data)`

Starts or continues execution using the supplied input.

Returns a `Promise<FrameResult>`.

Depending on the execution flow, the result can represent a completed execution or a suspended execution.

## Execution Result

The runtime returns a `FrameResult` with the following structure:

```typescript
interface FrameResult {
	type: 'wait' | 'spawn' | 'completed'
	frameId: string
	data: any
	spawnIdentifier: string
}
```

- `type`: Describes the execution outcome.
- `frameId`: Identifier of the frame that produced the result.
- `data`: Data returned by the callable.
- `spawnIdentifier`: Identifier of the spawned callable, if applicable.

## Building Agentic Systems

Mending.js is designed to be a foundation for higher-level execution systems, including agentic applications.

Since a callable can spawn another callable, execution can be composed dynamically rather than being restricted to a predefined sequence.

For example, an application could build a hierarchy of agents:

```text
Main Agent
    |
    └── Research Agent
            |
            └── Research Workflow
                    |
                    ├── Web Agent
                    |       |
                    |       └── Wait for human approval
                    |
                    └── Analysis Agent
                            |
                            └── Wait for additional input
```

Each agent can independently request execution of other callables or suspend its execution when external input is required.

Mending.js manages the execution lifecycle and result propagation, while the consuming application remains responsible for orchestration, planning, and decision-making.

The runtime itself has no dependency on agents or LLMs. It can execute any compatible callable.

## Current Limitations

Mending.js is experimental. The following limitations should be considered when using it:

- **No npm release:** The project has not been published to the npm registry.
- **Unstable API:** Public interfaces may change without notice.
- **In-memory execution state:** Runtime state is maintained within the runtime instance. Persistent storage and recovery across process restarts are not currently provided.
- **Single waiting frame:** The current implementation maintains a single waiting frame per runtime instance.
- **No distributed execution:** The runtime does not currently coordinate execution across multiple processes or machines.
- **No automatic retries:** Failed callable executions are not automatically retried.
- **No execution durability guarantees:** Applications should not assume that execution state survives application restarts.
- **No orchestration layer:** Agent planning, scheduling, delegation strategies, and decision-making are outside the scope of the runtime.

For practical examples covering basic execution, dynamic callable spawning, suspension, and nested execution, check out the [Examples](./examples/README.md).

## Development Status

Mending.js is an experimental project and is still evolving.

There is currently no defined development roadmap, and the API should be considered unstable. Features, interfaces, and execution semantics may change as the project develops.

Feedback, experimentation, and contributions are welcome.
