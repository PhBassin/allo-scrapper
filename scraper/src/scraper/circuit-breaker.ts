export class CircuitOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

export type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;

  constructor(
    private threshold: number = 5,
    private cooldownMs: number = 60000,
    private isFailure: (err: any) => boolean = () => true
  ) {}

  public getState(): CircuitState {
    // If open and cooldown has passed, transition to half-open
    if (this.state === 'open' && Date.now() - this.lastFailureTime > this.cooldownMs) {
      this.state = 'half-open';
    }
    return this.state;
  }

  public getFailureCount(): number {
    return this.failureCount;
  }

  public async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'open') {
      throw new CircuitOpenError('Circuit breaker is open');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      if (this.isFailure(err)) {
        this.onFailure();
      } else {
        // If it's not a failure from the circuit breaker's perspective (e.g. 404),
        // we might still want to consider it a success for the circuit state
        // to reset the failure count (like a successful half-open test).
        this.onSuccess();
      }
      throw err;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.threshold) {
      this.state = 'open';
    }
  }
}
