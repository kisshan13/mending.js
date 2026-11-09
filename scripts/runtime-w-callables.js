import { Callable, Runtime } from '../dist/index.js'

const runtime = new Runtime()

const baseCallable = new Callable('callable-1', async (ctx) => {
	console.log('Args : ')
	console.log(ctx.data)

	return ctx.complete('message this one is completed')
})

runtime.setDefault(baseCallable)

const data = await runtime.execute({ hii: 'hello' })

console.log(data)
