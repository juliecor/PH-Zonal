declare module 'nprogress' {
  interface NProgressOptions {
    minimum?: number;
    template?: string;
    easing?: string;
    speed?: number;
    trickle?: boolean;
    trickleSpeed?: number;
    showSpinner?: boolean;
    parent?: string;
  }

  interface NProgressStatic {
    configure(options: NProgressOptions): NProgressStatic;
    start(): NProgressStatic;
    done(force?: boolean): NProgressStatic;
    set(n: number): NProgressStatic;
    inc(amount?: number): NProgressStatic;
    remove(): void;
    status: number | null;
  }

  const NProgress: NProgressStatic;
  export default NProgress;
}
