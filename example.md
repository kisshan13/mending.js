# Mending.js examples

These examples use the API exported by the supplied source. Every example creates a `CallableRegistry` and passes it to `new Runtime({ registry })`. They assume a locally built package and imports from `../dist/index.js`.

> **Development status:** The runtime is experimental. The examples show its intended execution API; see the [root README](./README.md#current-limitations-and-implementation-caveats) for current frame-stack and persistence issues.

## 1. Basic callable execution

Create a callable with initial state, select it as the runtime entrypoint, and execute it.

```typescript
import { Callable, CallableRegistry, Runtime } from '../dist/index.js'

const registry = new CallableRegistry()

const baseCallable = new Callable(
	'callable-1',
	async (ctx) => {
		console.log('Initial count:', ctx.state.get('count'))
		ctx.state.set('count', (count) => count + 1)

		return ctx.complete({
			message: 'This callable is completed',
			count: ctx.state.get('count'),
		})
	},
	{ count: 0 }
)

const runtime = new Runtime({ registry })
runtime.setDefault(baseCallable)

const result = await runtime.execute({ hello: 'world' })

console.log(result.type) // 'completed'
console.log(result.data) // { message: 'This callable is completed', count: 1 }
```

**What happens?** The runtime finds the entrypoint, creates a frame with the supplied input, invokes the callable with its state, and returns a `FrameResult`. Calling `setDefault()` also registers that callable, so a separate `register()` call is unnecessary.

## 2. Dynamic callable spawning

An orchestrator can delegate work by **returning** `ctx.spawn(data, callable)`; the runtime resolves the child callable from its registry. When the child completes, the parent is invoked again with the child's completion data.

```typescript
import { Callable, CallableRegistry, Runtime } from '../dist/index.js'

const worker = new Callable('worker', async (ctx) => {
	console.log('Worker input:', ctx.data)

	return ctx.complete({
		message: 'Worker completed successfully',
		processed: ctx.data.value * 2,
	})
})

const orchestrator = new Callable(
	'orchestrator',
	async (ctx) => {
		if (!ctx.state.get('workerSpawned')) {
			ctx.state.set('workerSpawned', () => true)
			return ctx.spawn({ value: ctx.data.value }, worker)
		}

		// This invocation receives the completed worker's result.
		return ctx.complete({
			message: 'Orchestration completed',
			workerResult: ctx.data,
		})
	},
	{ workerSpawned: false }
)

const registry = new CallableRegistry()
const runtime = new Runtime({ registry })

runtime.register(worker)
runtime.setDefault(orchestrator)

const result = await runtime.execute({ value: 21 })
console.log(result.type) // 'completed'
console.log(result.data.workerResult.processed) // 42
```

**Execution flow:**

1. The entrypoint runs and returns a `spawn` result for `worker`.
2. The runtime creates a child frame and invokes `worker`.
3. The worker completes with `{ processed: 42, ... }`.
4. The runtime replaces the parent's input with that completion data and invokes the parent again.
5. `workerSpawned` prevents a repeated spawn, so the parent completes.

The worker must be registered beforehand. Parent re-invocation starts the execution function again; it does not restore local variables from the previous invocation.

## 3. Suspending and resuming execution

A callable can return `wait` when it needs input from outside the runtime. The application then calls `execute()` again **on the same runtime instance**.

```typescript
import { Callable, CallableRegistry, Runtime } from '../dist/index.js'

const approval = new Callable('approval', async (ctx) => {
	if (ctx.data.approved !== true) {
		ctx.state.set('amount', () => ctx.data.amount)

		return ctx.wait({
			reason: 'approval_required',
			amount: ctx.data.amount,
		})
	}

	return ctx.complete({
		status: 'approved',
		amount: ctx.state.get('amount'),
	})
})

const registry = new CallableRegistry()
const runtime = new Runtime({ registry })
runtime.setDefault(approval)

const waitingResult = await runtime.execute({
	amount: 500,
	approved: false,
})

console.log(waitingResult.type) // 'wait'
console.log(waitingResult.data)
// { reason: 'approval_required', amount: 500 }

// Simulate receiving an external approval.
const completedResult = await runtime.execute({ approved: true })

console.log(completedResult.type) // 'completed'
console.log(completedResult.data)
// { status: 'approved', amount: 500 }
```

**Important behavior:** The resumed input replaces the waiting frame's previous input. Because the approval response does not contain `amount`, the callable stores it in `CallableState` before waiting. Only the callable's data and state are retained; execution does not resume inside a previous JavaScript function call.

## 4. Nested execution with two suspension points

A parent can spawn a child that spawns another child. Any level can wait, provided waits occur sequentially. In this example, the Web Agent requests access approval; after it completes, the Research Agent requests review approval.

```text
Main Agent
  └── Research Agent
       └── Web Agent
            └── WAIT: Web access approval
       └── WAIT: Research review
  └── Main Agent completes
```

```typescript
import { Callable, CallableRegistry, Runtime } from '../dist/index.js'

const webAgent = new Callable('web-agent', async (ctx) => {
	if (ctx.data.approved !== true) {
		ctx.state.set('topic', () => ctx.data.topic)
		return ctx.wait({
			reason: 'web_access_approval',
			topic: ctx.data.topic,
		})
	}

	return ctx.complete({
		topic: ctx.state.get('topic'),
		research: 'Collected research data from the web',
	})
})

const researchAgent = new Callable(
	'research-agent',
	async (ctx) => {
		if (!ctx.state.get('webAgentStarted')) {
			ctx.state.set('webAgentStarted', () => true)
			return ctx.spawn({ topic: ctx.data.topic }, webAgent)
		}

		if (!ctx.state.get('reviewRequested')) {
			ctx.state.set('webResult', () => ctx.data)
			ctx.state.set('reviewRequested', () => true)

			return ctx.wait({
				reason: 'research_review',
				research: ctx.data,
			})
		}

		return ctx.complete({
			research: ctx.state.get('webResult'),
			approved: ctx.data.reviewApproved,
		})
	},
	{ webAgentStarted: false, reviewRequested: false }
)

const mainAgent = new Callable(
	'main-agent',
	async (ctx) => {
		if (!ctx.state.get('researchStarted')) {
			ctx.state.set('researchStarted', () => true)
			return ctx.spawn({ topic: 'AI Agent Frameworks' }, researchAgent)
		}

		return ctx.complete({
			status: 'completed',
			result: ctx.data,
		})
	},
	{ researchStarted: false }
)

const registry = new CallableRegistry()
const runtime = new Runtime({ registry })

runtime.register(webAgent)
runtime.register(researchAgent)
runtime.setDefault(mainAgent)

// 1. The Web Agent waits for permission.
const firstResult = await runtime.execute({})
console.log(firstResult.type, firstResult.data.reason)
// wait web_access_approval

// 2. The Web Agent completes; the Research Agent waits for review.
const secondResult = await runtime.execute({ approved: true })
console.log(secondResult.type, secondResult.data.reason)
// wait research_review

// 3. The Research Agent completes; the Main Agent completes.
const thirdResult = await runtime.execute({ reviewApproved: true })
console.log(thirdResult.type, thirdResult.data.status)
// completed completed
```

**Execution flow:**

1. `main-agent` spawns `research-agent`, which spawns `web-agent`.
2. `web-agent` returns `wait`. The first `execute()` call returns this wait result.
3. The second `execute()` resumes `web-agent`; its completion data returns to `research-agent`.
4. `research-agent` stores the child result and waits for human review.
5. The third `execute()` resumes `research-agent`; it completes and passes its result to `main-agent`.
6. `main-agent` is re-invoked and completes.

These are **sequential waits**, not multiple simultaneous waiting frames. Each `execute()` call uses the same `runtime`. The current runtime stores only one waiting frame at a time.

## 5. Serializing and loading a configured runtime

The source exposes `persist()` and `Runtime.load()`. Restoring a snapshot requires a registry containing the callable implementations referenced by identifier.

This example intentionally serializes **before execution**, avoiding the current limitations around restoring waiting frames or active frame stacks.

```typescript
import { Callable, CallableRegistry, Runtime } from '../dist/index.js'

const task = new Callable('task', async ({ data, complete }) => {
	return complete({ result: data.value * 2 })
})

const registry = new CallableRegistry()
registry.add(task)

const runtime = new Runtime({ registry })
runtime.setDefault(task)

// Save the snapshot as JSON. Store it externally if needed.
const snapshot = JSON.stringify(runtime.persist())

// Recreate the registry and callables in the process that loads it.
// This example reuses them for brevity.
const restored = Runtime.load({
	registry,
	data: JSON.parse(snapshot),
})

const result = await restored.execute({ value: 21 })
console.log(result.type) // 'completed'
console.log(result.data) // { result: 42 }
```

`Runtime.load()` accepts `{ registry, data }` where `data` is the object produced by `runtime.persist()` (or a parsed JSON representation of it). It does **not** accept the serialized JSON string directly.

### What persistence currently contains

| Component       | Serialized information                                                  |
| --------------- | ----------------------------------------------------------------------- |
| `Runtime`       | Schema, kind, and nested runtime state.                                 |
| `RuntimeState`  | Normal frames, executing frames, entrypoint identifier, callable state. |
| `Frame`         | Frame identifier, callable identifier, parameters.                      |
| `CallableState` | State values keyed by string.                                           |

A callable implementation is not serialized. The registry must resolve every referenced callable identifier when loading frames and the entrypoint.

### What persistence does not yet guarantee

The waiting frame (`RuntimeState.waiting`) is **not** included in the serialized snapshot. Saving a runtime after it returns `wait` and then loading that snapshot is **not** a supported way to resume the waiting callable. The source also has a frame-stack issue that can leave surplus normal frames during execution. Use this API as an experimental serialization mechanism, not as a durable workflow engine.

## Notes

- `CallableState` is shared by callable identifier, not isolated per frame.
- Each callable should **return** the result constructed by `ctx.complete`, `ctx.spawn`, or `ctx.wait`.
- `runtime.register(child)` or `registry.add(child)` must be called before spawning the child.
- A completion propagates data to the parent by replacing the parent's input and re-running its function.
- A new `execute()` call resumes a waiting callable with **replacement** input, not merged input.
- The current runtime does not perform automatic retries or coordinate execution across processes.

For API details and known implementation issues, see the [Mending.js README](../README.md).
