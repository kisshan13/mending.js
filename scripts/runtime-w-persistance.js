import { Callable, Runtime } from '../dist/index.js'

const runtime = new Runtime()

const baseCallable = new Callable(
	'callable-1',
	async (ctx) => {
		console.log(ctx.state.get('count'))

		return ctx.complete('message this one is completed')
	},
	{ count: 0 }
)

runtime.setDefault(baseCallable)

const data = await runtime.execute({ hii: 'hello' })

console.log(data)

console.log('\n\n')

console.log(JSON.stringify(runtime.persist(), null, 2))
