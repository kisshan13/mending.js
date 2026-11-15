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

const firstResult = await runtime.execute({})
console.log(firstResult.type, firstResult.data.reason)

const secondResult = await runtime.execute({ approved: true })
console.log(secondResult.type, secondResult.data.reason)

const thirdResult = await runtime.execute({ reviewApproved: true })
console.log(thirdResult.type, thirdResult.data.status)
