export class RuntimeError extends Error {
    constructor(message: string) {
        super(message)
    }
}

export class RuntimeEntrypointError extends RuntimeError {
    constructor(message: string) {
        super(message)
    }
}

export class RuntimeFrameError extends RuntimeError {
    constructor(message: string) {
        super(message)
    }
}

export class FrameMissingSpawnId extends Error {
    constructor(message: string) {
        super(message)
    }
}

export class RuntimeCallableNotFound extends RuntimeError {
    constructor(message: string) {
        super(message)
    }
}