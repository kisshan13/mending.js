import { Callable, CallableRegistry, Runtime } from '../dist/index.js'

const task = new Callable('task', async ({ data, complete }) => {
	return complete({ result: data.value * 2 })
})

const registry = new CallableRegistry()
registry.add(task)

const runtime = new Runtime({ registry })
runtime.setDefault(task)

const snapshot = JSON.stringify(runtime.persist())

const restored = Runtime.load({
	registry,
	data: JSON.parse(snapshot),
})

const result = await restored.execute({ value: 21 })
console.log(result.type)
console.log(result.data)
