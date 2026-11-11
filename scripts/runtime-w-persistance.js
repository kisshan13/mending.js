import { Callable, CallableRegistry, Runtime } from '../dist/index.js'

const registry = new CallableRegistry()

const baseCallable = new Callable(
	'callable-1',
	async (ctx) => {
		console.log(ctx.state.get('count'))

		return ctx.complete('message this one is completed')
	},
	{ count: 0 }
)

registry.add(baseCallable)

const runtime = new Runtime({ registry: registry })

runtime.setDefault(baseCallable)

const data = await runtime.execute({ hii: 'hello' })

console.log(data)

console.log('\n\n')

console.log(JSON.stringify(runtime.persist(), null, 2))
