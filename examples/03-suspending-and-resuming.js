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

console.log(waitingResult.type)
console.log(waitingResult.data)

const completedResult = await runtime.execute({ approved: true })

console.log(completedResult.type)
console.log(completedResult.data)
