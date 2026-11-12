import { Callable, CallableRegistry, Runtime } from '../dist/index.js'

const registry = new CallableRegistry()

const secCallable = new Callable(
	'callable-2',
	async (ctx) => {
		if (ctx.state.get('count') === 0) {
			ctx.state.set('count', (val) => 1)

			return ctx.wait({ count: ctx.state.get('count'), from: 'callable-2' })
		}

		return ctx.complete('callable-2')
	},
	{ count: 0 }
)

const baseCallable = new Callable(
	'callable-1',
	async (ctx) => {
		if (ctx.state.get('count') === 0) {
			ctx.state.set('count', (val) => 1)

			return ctx.spawn({ count: 0 }, secCallable)
		}

		return ctx.complete('message this one is completed')
	},
	{ count: 0 }
)

registry.add(baseCallable, secCallable)

const runtime = new Runtime({ registry: registry })

runtime.setDefault(baseCallable)

const data = await runtime.execute({ hii: 'hello' })
console.log(data)

const persistedData = runtime.persist()

console.log(JSON.stringify(persistedData, null, 2))

const newRuntime = Runtime.load({ registry: registry, data: persistedData })

const newData = await newRuntime.execute({ hii: 'hello' })
console.log(newData)

console.log(JSON.stringify(newRuntime.persist(), null, 2))
