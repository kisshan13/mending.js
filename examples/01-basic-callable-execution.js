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

console.log(result.type)
console.log(result.data)
