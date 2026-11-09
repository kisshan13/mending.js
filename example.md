# Examples

The following examples demonstrate the core execution primitives provided by Mending.js.

## 1. Basic Callable Execution

The simplest way to use Mending.js is to create a callable, register it as the default entrypoint, and execute the runtime.

```typescript
import { Callable, Runtime } from '../dist/index.js'

const runtime = new Runtime()

const baseCallable = new Callable(
	'callable-1',
	async (ctx) => {
		console.log(ctx.state.get('count'))

		return ctx.complete('This callable is completed')
	},
	{
		count: 0,
	}
)

runtime.setDefault(baseCallable)

const result = await runtime.execute({
	hii: 'hello',
})

console.log(result)
```

**What's happening?**

1. A callable is created with the identifier `callable-1`.
2. An initial state is provided with `count` set to `0`.
3. The callable is registered as the runtime's entrypoint.
4. The runtime executes the callable with the provided input.
5. The callable returns a completion result.

The runtime returns a `FrameResult` containing the completion data and frame identifier.

## 2. Dynamic Callable Spawning

A callable can dynamically request the execution of another callable using `ctx.spawn()`.

This allows execution to be delegated without directly invoking another callable.

```typescript
import { Callable, Runtime } from '../dist/index.js'

const runtime = new Runtime()

const worker = new Callable('worker', async (ctx) => {
	console.log('Worker executing:', ctx.data)

	return ctx.complete({
		message: 'Worker completed successfully',
		processed: ctx.data.value * 2,
	})
})

const orchestrator = new Callable('orchestrator', async (ctx) => {
	// Check whether the worker has already executed.
	if (!ctx.state.get('workerSpawned')) {
		ctx.state.set('workerSpawned', () => true)

		console.log('Spawning worker...')

		return ctx.spawn({ value: 21 }, worker)
	}

	// The callable receives the worker's completion data.
	console.log('Worker result:', ctx.data)

	return ctx.complete({
		message: 'Orchestration completed',
		workerResult: ctx.data,
	})
})

runtime.register(worker)
runtime.setDefault(orchestrator)

const result = await runtime.execute({
	task: 'process-data',
})

console.log(result)
```

**What's happening?**

1. The runtime starts executing `orchestrator`.
2. The orchestrator requests execution of `worker` using `ctx.spawn()`.
3. The runtime creates a new frame for the worker and executes it.
4. The worker completes and returns its result.
5. The runtime propagates the result back to the parent callable.
6. The orchestrator is invoked again with the worker's result.
7. The orchestrator completes the execution.

Notice that the orchestrator doesn't directly call the worker. It delegates execution to the runtime.

## 3. Suspending and Resuming Execution

A callable can suspend its execution when external input is required.

The runtime returns the waiting result to the application. The application can provide the required input through another call to `execute()` on the same runtime instance.

```typescript
import { Callable, Runtime } from '../dist/index.js'

const runtime = new Runtime()

const approval = new Callable('approval', async (ctx) => {
	// Initial execution: approval has not been provided.
	if (!ctx.data.approved) {
		ctx.state.set('amount', () => ctx.data.amount)

		console.log('Waiting for approval...')

		return ctx.wait({
			reason: 'approval_required',
			amount: ctx.data.amount,
		})
	}

	// Resumed execution.
	console.log('Approval received!')

	return ctx.complete({
		status: 'approved',
		amount: ctx.state.get('amount'),
	})
})

runtime.setDefault(approval)

// First execution.
const waitingResult = await runtime.execute({
	amount: 500,
	approved: false,
})

console.log('Waiting result:', waitingResult)

// Simulate receiving external input.
const completedResult = await runtime.execute({
	approved: true,
})

console.log('Completed result:', completedResult)
```

**What's happening?**

1. The callable starts executing with an amount of `500`.
2. Since approval has not been provided, it returns `ctx.wait()`.
3. The runtime retains the waiting frame in its current execution state.
4. The application receives the waiting result and can return it to the client.
5. Once approval is received, the application calls `runtime.execute()` again with the new input.
6. The runtime re-invokes the waiting callable with the updated input.
7. The callable retrieves its previously stored amount from `CallableState`.
8. The callable completes its execution.

## 4. Nested Execution with Multiple Suspension Points

Mending.js allows a callable to spawn another callable, which can independently spawn additional callables.

This also means that suspension is not restricted to the entrypoint. A callable at any level of the execution hierarchy can request external input.

Consider a scenario where a Main Agent delegates research to a Research Agent, which subsequently spawns a Web Agent.

Both agents can request external intervention at different stages of execution.

```text
Main Agent
    |
    └── Research Agent
            |
            └── Web Agent
                    |
                    └── WAIT: Request web access approval

            |
            └── WAIT: Request research review

    |
    └── Main Agent resumes and completes
```

### Implementation

```typescript
import { Callable, Runtime } from '../dist/index.js'

const runtime = new Runtime()

// Level 3: Web Agent
const webAgent = new Callable('web-agent', async (ctx) => {
	if (ctx.data.approved !== true) {
		ctx.state.set('topic', () => ctx.data.topic)

		console.log('Web Agent: Waiting for approval...')

		return ctx.wait({
			reason: 'web_access_approval',
			topic: ctx.data.topic,
		})
	}

	console.log('Web Agent: Approval received!')

	return ctx.complete({
		topic: ctx.state.get('topic'),
		research: 'Collected research data from the web',
	})
})

// Level 2: Research Agent
const researchAgent = new Callable('research-agent', async (ctx) => {
	// Spawn the Web Agent on the first invocation.
	if (!ctx.state.get('web-agent-started')) {
		ctx.state.set('web-agent-started', () => true)

		console.log('Research Agent: Spawning Web Agent')

		return ctx.spawn({ topic: ctx.data.topic }, webAgent)
	}

	// The Web Agent has completed.
	// Store its result before requesting human review.
	if (!ctx.state.get('review-requested')) {
		ctx.state.set('web-result', () => ctx.data)
		ctx.state.set('review-requested', () => true)

		console.log('Research Agent: Waiting for review...')

		return ctx.wait({
			reason: 'research_review',
			research: ctx.data,
		})
	}

	console.log('Research Agent: Review received!')

	return ctx.complete({
		research: ctx.state.get('web-result'),
		approved: ctx.data.reviewApproved,
	})
})

// Level 1: Main Agent
const mainAgent = new Callable('main-agent', async (ctx) => {
	if (!ctx.state.get('research-started')) {
		ctx.state.set('research-started', () => true)

		console.log('Main Agent: Starting research')

		return ctx.spawn({ topic: 'AI Agent Frameworks' }, researchAgent)
	}

	console.log('Main Agent: Research completed')

	return ctx.complete({
		status: 'completed',
		result: ctx.data,
	})
})

// Register callables.
runtime.register(webAgent)
runtime.register(researchAgent)
runtime.setDefault(mainAgent)

// Execution 1: Start the entire hierarchy.
const firstResult = await runtime.execute({})

console.log('Execution 1:', firstResult)

// Execution 2: Provide Web Agent approval.
const secondResult = await runtime.execute({
	approved: true,
})

console.log('Execution 2:', secondResult)

// Execution 3: Provide Research Agent approval.
const thirdResult = await runtime.execute({
	reviewApproved: true,
})

console.log('Execution 3:', thirdResult)
```

### Execution Flow

The example demonstrates three separate calls to the runtime.

**First execution**

- Main Agent spawns Research Agent.
- Research Agent spawns Web Agent.
- Web Agent requests web access approval.
- Runtime returns a `wait` result.

**Second execution**

- Application provides web access approval.
- Web Agent resumes and completes.
- Its result propagates to Research Agent.
- Research Agent requests an additional review.
- Runtime returns another `wait` result.

**Third execution**

- Application provides research approval.
- Research Agent resumes and completes.
- Its result propagates to Main Agent.
- Main Agent resumes and completes the overall execution.

The important characteristic is that neither the Main Agent nor the application needs to manually manage the internal callable hierarchy.

Each callable is responsible for its own execution logic, while the runtime manages execution transitions and result propagation.

**Note:** This example illustrates sequential suspension points, not simultaneous waiting agents. The current runtime maintains a single waiting frame per instance, and all three executions must use the same runtime instance. Persistent restoration across process restarts is not currently supported.

---

These examples cover the basic execution lifecycle of Mending.js: executing callables, dynamically spawning other callables, and suspending and resuming execution.
